import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MARKETPLACE_SYNC_INTERVAL_MS,
  createMarketplaceSyncCoordinator,
  getManualMarketplaceSyncTarget,
  isMarketplaceAutoSyncOpenAt,
  syncMarketplaceOrderOnDemand,
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
    getOpenMarketplaceOrdersForHistory: async () => ({ data: [], error: null }),
    syncMarketplaceOrderStatus: async () => ({ order: null, error: null }),
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

test('uses the device-configured marketplace polling interval', async () => {
  const scheduled: Array<{ delayMs: number }> = [];
  const coordinator = createMarketplaceSyncCoordinator({
    getActiveOrders: async (provider) => activeResult(provider, []),
    getOrderDetail: async () => {
      throw new Error('empty active lists must not load details');
    },
    importMarketplaceOrder: async () => ({ order: null, created: false, error: null }),
    getOpenMarketplaceOrdersForHistory: async () => ({ data: [], error: null }),
    syncMarketplaceOrderStatus: async () => ({ order: null, error: null }),
    intervalMs: 90_000,
    setInterval: (_callback, delayMs) => {
      scheduled.push({ delayMs });
      return 'poll-timer';
    },
    clearInterval: () => undefined,
  });

  await coordinator.start();

  assert.deepEqual(scheduled, [{ delayMs: 90_000 }]);
  coordinator.stop();
});

test('only enables marketplace auto-sync from 11:00am until 8:00pm Melbourne time', () => {
  assert.equal(isMarketplaceAutoSyncOpenAt(new Date('2026-01-14T23:59:59.000Z')), false);
  assert.equal(isMarketplaceAutoSyncOpenAt(new Date('2026-01-15T00:00:00.000Z')), true);
  assert.equal(isMarketplaceAutoSyncOpenAt(new Date('2026-01-15T08:59:59.000Z')), true);
  assert.equal(isMarketplaceAutoSyncOpenAt(new Date('2026-01-15T09:00:00.000Z')), false);
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
    getOpenMarketplaceOrdersForHistory: async () => ({ data: [], error: null }),
    syncMarketplaceOrderStatus: async () => ({ order: null, error: null }),
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
    getOpenMarketplaceOrdersForHistory: async () => ({ data: [], error: null }),
    syncMarketplaceOrderStatus: async () => ({ order: null, error: null }),
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

test('reports provider poll failure and clears it after a later successful active response', async () => {
  const failures: string[] = [];
  const successes: string[] = [];
  let shouldFail = true;
  const coordinator = createMarketplaceSyncCoordinator({
    getActiveOrders: async (provider) => {
      if (provider === 'uber_eats' && shouldFail) throw new Error('offline');
      return activeResult(provider, []);
    },
    getOrderDetail: async () => { throw new Error('not needed'); },
    importMarketplaceOrder: async () => ({ order: null, created: false, error: null }),
    getOpenMarketplaceOrdersForHistory: async () => ({ data: [], error: null }),
    syncMarketplaceOrderStatus: async () => ({ order: null, error: null }),
    logError: () => undefined,
    onProviderPollFailure: (provider) => failures.push(provider),
    onProviderPollSuccess: (provider) => successes.push(provider),
  });

  await coordinator.poll();
  shouldFail = false;
  await coordinator.poll();

  assert.deepEqual(failures, ['uber_eats']);
  assert.deepEqual(successes, ['doordash', 'uber_eats', 'doordash']);
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
    getOpenMarketplaceOrdersForHistory: async () => ({ data: [], error: null }),
    syncMarketplaceOrderStatus: async () => ({ order: null, error: null }),
    logError: (message) => logged.push(message),
  });

  await coordinator.poll();

  assert.deepEqual(imported, ['UE-good']);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /UE-broken/);
});

test('reconciles a missing DoorDash on-the-way order through history using status-only sync', async () => {
  const detailCalls: Array<{ provider: string; workflowUuid: string; mode: string | undefined }> = [];
  const statusCalls: Array<{ provider: string; externalOrderId: string; orderId: string }> = [];
  let importCalls = 0;
  const dependencies = {
    getActiveOrders: async (provider: 'uber_eats' | 'doordash') => activeResult(provider, []),
    getOrderDetail: async (
      provider: 'uber_eats' | 'doordash',
      workflowUuid: string,
      options?: { mode?: 'history' | 'live' }
    ) => {
      detailCalls.push({ provider, workflowUuid, mode: options?.mode });
      return detail(provider, ' DD-42 ');
    },
    importMarketplaceOrder: async () => {
      importCalls += 1;
      return { order: null, created: false, error: null };
    },
    getOpenMarketplaceOrdersForHistory: async () => ({
      data: [{
        id: 'local-dd-42',
        provider: 'doordash' as const,
        externalOrderId: ' DD-42 ',
        workflowUuid: ' dd-history-workflow ',
        orderStatus: 'on_the_way' as const,
      }],
      error: null,
    }),
    syncMarketplaceOrderStatus: async (
      provider: 'uber_eats' | 'doordash',
      externalOrderId: string,
      orderDetail: ReturnType<typeof detail>
    ) => {
      statusCalls.push({ provider, externalOrderId, orderId: orderDetail.orderId });
      return { order: null, error: null };
    },
    logError: () => undefined,
  };
  const coordinator = createMarketplaceSyncCoordinator(dependencies);

  await coordinator.poll();

  assert.deepEqual(detailCalls, [{
    provider: 'doordash',
    workflowUuid: 'dd-history-workflow',
    mode: 'history',
  }]);
  assert.deepEqual(statusCalls, [{
    provider: 'doordash',
    externalOrderId: 'DD-42',
    orderId: ' DD-42 ',
  }]);
  assert.equal(importCalls, 0);
});

test('does not history-fetch active, terminal, or workflow-less local marketplace orders', async () => {
  const historyCalls: string[] = [];
  const dependencies = {
    getActiveOrders: async (provider: 'uber_eats' | 'doordash') => activeResult(
      provider,
      provider === 'uber_eats'
        ? [{ orderId: ' UE-active ', workflowUuid: 'active-workflow' }]
        : []
    ),
    getOrderDetail: async (
      provider: 'uber_eats' | 'doordash',
      workflowUuid: string,
      options?: { mode?: 'history' | 'live' }
    ) => {
      if (options?.mode === 'history') historyCalls.push(workflowUuid);
      return detail(provider, 'UE-active');
    },
    importMarketplaceOrder: async () => ({ order: null, created: false, error: null }),
    getOpenMarketplaceOrdersForHistory: async () => ({
      data: [
        {
          id: 'active',
          provider: 'uber_eats' as const,
          externalOrderId: 'UE-active',
          workflowUuid: 'active-history-workflow',
          orderStatus: 'preparing' as const,
        },
        {
          id: 'terminal',
          provider: 'uber_eats' as const,
          externalOrderId: 'UE-terminal',
          workflowUuid: 'terminal-workflow',
          orderStatus: 'completed' as const,
        },
        {
          id: 'no-workflow',
          provider: 'doordash' as const,
          externalOrderId: 'DD-no-workflow',
          workflowUuid: null,
          orderStatus: 'on_the_way' as const,
        },
      ],
      error: null,
    }),
    syncMarketplaceOrderStatus: async () => ({ order: null, error: null }),
    logError: () => undefined,
  };
  const coordinator = createMarketplaceSyncCoordinator(dependencies);

  await coordinator.poll();

  assert.deepEqual(historyCalls, []);
});

test('continues history reconciliation after another missing order fails', async () => {
  const statusCalls: string[] = [];
  const logged: string[] = [];
  const dependencies = {
    getActiveOrders: async (provider: 'uber_eats' | 'doordash') => activeResult(provider, []),
    getOrderDetail: async (
      provider: 'uber_eats' | 'doordash',
      workflowUuid: string,
      options?: { mode?: 'history' | 'live' }
    ) => {
      assert.equal(options?.mode, 'history');
      if (workflowUuid === 'broken-workflow') throw new Error('history unavailable');
      return detail(provider, 'UE-good');
    },
    importMarketplaceOrder: async () => ({ order: null, created: false, error: null }),
    getOpenMarketplaceOrdersForHistory: async () => ({
      data: [
        {
          id: 'broken',
          provider: 'uber_eats' as const,
          externalOrderId: 'UE-broken',
          workflowUuid: 'broken-workflow',
          orderStatus: 'preparing' as const,
        },
        {
          id: 'good',
          provider: 'uber_eats' as const,
          externalOrderId: 'UE-good',
          workflowUuid: 'good-workflow',
          orderStatus: 'preparing' as const,
        },
      ],
      error: null,
    }),
    syncMarketplaceOrderStatus: async (
      _provider: 'uber_eats' | 'doordash',
      externalOrderId: string
    ) => {
      statusCalls.push(externalOrderId);
      return { order: null, error: null };
    },
    logError: (message: string) => logged.push(message),
  };
  const coordinator = createMarketplaceSyncCoordinator(dependencies);

  await coordinator.poll();

  assert.deepEqual(statusCalls, ['UE-good']);
  assert.equal(logged.length, 1);
  assert.match(logged[0], /UE-broken/);
});

test('manual sync targets only supported third-party orders with persisted identity', () => {
  assert.deepEqual(getManualMarketplaceSyncTarget({
    order_channel: 'third_party',
    delivery_partner_name: 'DoorDash',
    external_order_number: ' DD-9 ',
    marketplace_workflow_uuid: ' workflow-9 ',
  }), {
    provider: 'doordash',
    externalOrderId: 'DD-9',
    workflowUuid: 'workflow-9',
  });
  assert.equal(getManualMarketplaceSyncTarget({
    order_channel: 'third_party',
    delivery_partner_name: 'Menulog',
    external_order_number: 'ML-9',
    marketplace_workflow_uuid: 'workflow-9',
  }), null);
  assert.equal(getManualMarketplaceSyncTarget({
    order_channel: 'instore',
    delivery_partner_name: 'Uber Eats',
    external_order_number: 'UE-9',
    marketplace_workflow_uuid: 'workflow-9',
  }), null);
  assert.equal(getManualMarketplaceSyncTarget({
    order_channel: 'third_party',
    delivery_partner_name: 'Uber Eats',
    external_order_number: 'UE-9',
    marketplace_workflow_uuid: null,
  }), null);
});

test('manual sync falls back from live detail to history and performs status-only sync', async () => {
  const detailModes: string[] = [];
  const statusCalls: Array<{ provider: string; externalOrderId: string; orderId: string }> = [];
  const result = await syncMarketplaceOrderOnDemand({
    provider: 'uber_eats',
    externalOrderId: 'UE-77',
    workflowUuid: 'workflow-77',
    getOrderDetail: async (provider, _workflowUuid, options) => {
      detailModes.push(options.mode);
      if (options.mode === 'live') throw new Error('not active');
      return detail(provider, 'UE-77');
    },
    syncMarketplaceOrderStatus: async (provider, externalOrderId, orderDetail) => {
      statusCalls.push({ provider, externalOrderId, orderId: orderDetail.orderId });
      return { order: { id: 'local-77' }, error: null };
    },
  });

  assert.deepEqual(detailModes, ['live', 'history']);
  assert.deepEqual(statusCalls, [{
    provider: 'uber_eats',
    externalOrderId: 'UE-77',
    orderId: 'UE-77',
  }]);
  assert.deepEqual(result, { order: { id: 'local-77' }, error: null });
});
