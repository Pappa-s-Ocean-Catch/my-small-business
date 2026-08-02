import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MARKETPLACE_SYNC_INTERVAL_MS,
  createMarketplaceSyncCoordinator,
} from '../lib/marketplace-sync';

function activeResult(
  provider: 'uber_eats' | 'doordash',
  orders: Array<{ orderId: string; workflowUuid: string }>
) {
  return {
    provider,
    orders: orders.map((order) => ({
      ...order,
      orderUuid: `${order.workflowUuid}-order`,
      customerName: 'Customer',
      salesTotal: '$10.00',
      requestedAt: '2026-08-02T00:00:00.000Z',
      courierName: '',
      fulfillmentType: 'DELIVERY',
      orderChannel: provider,
      status: 'ACTIVE',
      statusDescription: 'Preparing',
    })),
    nextCursor: null,
  };
}

function detail(provider: 'uber_eats' | 'doordash', orderId: string) {
  return {
    provider,
    sourceName: provider === 'uber_eats' ? 'Uber Eats' : 'DoorDash',
    orderId,
    orderUUID: `${orderId}-uuid`,
    requestedAt: 1_754_000_000_000,
    completedAtTimestamp: null,
    customerName: 'Customer',
    customerPhone: null,
    customerAddress: null,
    courierName: null,
    courierPhone: null,
    restaurantName: 'Pappas',
    subtotal: '$10.00',
    subtotalAmount: 10,
    discountLabel: null,
    discount: null,
    discountAmount: 0,
    total: '$10.00',
    totalAmount: 10,
    netPayout: '$7.00',
    marketplaceFeeRate: null,
    fulfillmentType: 'DELIVERY',
    orderJobState: 'PREPARING',
    statusDescription: 'Preparing',
    checkoutInfo: [],
    orderStateChanges: [],
    items: [],
  };
}

test('starts with an immediate poll and schedules the next polls every 30 seconds', async () => {
  const scheduled: Array<{ callback: () => void; delayMs: number }> = [];
  const cleared: unknown[] = [];
  let activeRequests = 0;

  const coordinator = createMarketplaceSyncCoordinator({
    getActiveOrders: async (provider) => {
      activeRequests += 1;
      return activeResult(provider, []);
    },
    getOrderDetail: async () => {
      throw new Error('empty active lists must not load details');
    },
    importMarketplaceOrder: async () => ({ order: null, created: false, error: null }),
    logError: () => undefined,
    setInterval: (callback, delayMs) => {
      scheduled.push({ callback, delayMs });
      return 'poll-timer';
    },
    clearInterval: (handle) => {
      cleared.push(handle);
    },
  });

  await coordinator.start();

  assert.equal(activeRequests, 2);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delayMs, 30_000);
  assert.equal(MARKETPLACE_SYNC_INTERVAL_MS, 30_000);

  scheduled[0].callback();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(activeRequests, 4);

  coordinator.stop();
  assert.deepEqual(cleared, ['poll-timer']);
});

test('does not overlap a scheduled poll with one already in flight', async () => {
  let releaseFirstProvider: (() => void) | null = null;
  const firstProviderBlocked = new Promise<void>((resolve) => {
    releaseFirstProvider = resolve;
  });
  let scheduledPoll: (() => void) | null = null;
  let activeRequests = 0;

  const coordinator = createMarketplaceSyncCoordinator({
    getActiveOrders: async (provider) => {
      activeRequests += 1;
      if (provider === 'uber_eats') await firstProviderBlocked;
      return activeResult(provider, []);
    },
    getOrderDetail: async () => {
      throw new Error('empty active lists must not load details');
    },
    importMarketplaceOrder: async () => ({ order: null, created: false, error: null }),
    logError: () => undefined,
    setInterval: (callback) => {
      scheduledPoll = callback;
      return 'poll-timer';
    },
    clearInterval: () => undefined,
  });

  const firstPoll = coordinator.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(activeRequests, 2);

  assert.ok(scheduledPoll);
  (scheduledPoll as () => void)();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(activeRequests, 2);

  assert.ok(releaseFirstProvider);
  (releaseFirstProvider as () => void)();
  await firstPoll;
});

test('processes Uber Eats and DoorDash independently with live detail requests', async () => {
  const detailCalls: Array<{ provider: string; workflowUuid: string; mode: string | undefined }> = [];
  const imported: string[] = [];
  const logged: string[] = [];

  const coordinator = createMarketplaceSyncCoordinator({
    getActiveOrders: async (provider) => {
      if (provider === 'uber_eats') throw new Error('Uber session expired');
      return activeResult(provider, [{ orderId: 'DD-1', workflowUuid: 'dd-workflow' }]);
    },
    getOrderDetail: async (provider, workflowUuid, options) => {
      detailCalls.push({ provider, workflowUuid, mode: options?.mode });
      return detail(provider, 'DD-1');
    },
    importMarketplaceOrder: async (orderDetail) => {
      imported.push(orderDetail.orderId);
      return { order: null, created: true, error: null };
    },
    logError: (message) => logged.push(message),
  });

  await coordinator.poll();

  assert.deepEqual(detailCalls, [{
    provider: 'doordash',
    workflowUuid: 'dd-workflow',
    mode: 'live',
  }]);
  assert.deepEqual(imported, ['DD-1']);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /uber_eats/);
});

test('continues importing other active orders when one order fails', async () => {
  const imported: string[] = [];
  const logged: string[] = [];

  const coordinator = createMarketplaceSyncCoordinator({
    getActiveOrders: async (provider) => activeResult(
      provider,
      provider === 'uber_eats'
        ? [
          { orderId: 'UE-broken', workflowUuid: 'broken-workflow' },
          { orderId: 'UE-good', workflowUuid: 'good-workflow' },
        ]
        : []
    ),
    getOrderDetail: async (provider, workflowUuid) => {
      if (workflowUuid === 'broken-workflow') throw new Error('detail unavailable');
      return detail(provider, 'UE-good');
    },
    importMarketplaceOrder: async (orderDetail) => {
      imported.push(orderDetail.orderId);
      return { order: null, created: true, error: null };
    },
    logError: (message) => logged.push(message),
  });

  await coordinator.poll();

  assert.deepEqual(imported, ['UE-good']);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /UE-broken/);
});
