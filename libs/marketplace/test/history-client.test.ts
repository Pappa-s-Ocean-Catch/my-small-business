import assert from 'node:assert/strict';
import test from 'node:test';

import { createMarketplaceProviderClient } from '../src/client';

test('builds DoorDash history boundaries from the Melbourne calendar day', async () => {
  let body: Record<string, string> | null = null;
  const client = createMarketplaceProviderClient({
    getSession: async () => ({ provider: 'doordash', cookies: 'fixture', providerConfig: { businessId: 12, storeId: 34 }, updatedAt: null }),
    transport: async ({ init }) => {
      body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ orders: [] }), { status: 200 });
    },
  });
  await client.getHistory('doordash', { dateRange: 'TODAY' });
  assert.match(body!.dateGte, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  assert.match(body!.dateLt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

test('keeps Uber history rows when Uber uses uppercase UUID field names', async () => {
  const client = createMarketplaceProviderClient({
    getSession: async () => ({ provider: 'uber_eats', cookies: 'selectedRestaurant=store-1', providerConfig: {}, updatedAt: null }),
    transport: async () => new Response(JSON.stringify({ status: 'success', data: { orders: [{ orderId: 'UE-1', workflowUUID: 'workflow-1', orderUUID: 'order-1' }] } }), { status: 200 }),
  });
  const result = await client.getHistory('uber_eats', { dateRange: 'THIS_WEEK' });
  assert.deepEqual(result.orders.map((order) => ({ workflowUuid: order.workflowUuid, orderUuid: order.orderUuid })), [{ workflowUuid: 'workflow-1', orderUuid: 'order-1' }]);
});

test('preserves the complete Uber completed-history request contract', async () => {
  let request: { url: string; body: Record<string, any>; headers: Record<string, string> } | null = null;
  const client = createMarketplaceProviderClient({
    getSession: async () => ({ provider: 'uber_eats', cookies: 'session=value; selectedRestaurant=store-1', providerConfig: {}, updatedAt: null }),
    transport: async ({ url, init }) => {
      request = { url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> };
      return new Response(JSON.stringify({ status: 'success', data: { orders: [] } }), { status: 200 });
    },
  });

  await client.getHistory('uber_eats', { dateRange: 'THIS_MONTH', cursor: 'page-2' });

  assert.equal(request!.url, 'https://merchants.ubereats.com/manager/api/getHistoricOrders?localeCode=en-AU');
  assert.deepEqual(request!.body.filters, {
    currentTab: '',
    displayCurrencyCode: '',
    locationConstraints: { cities: [], countries: [], locationUuids: ['store-1'] },
    dateFilter: {
      startDate: request!.body.filters.dateFilter.startDate,
      endDate: request!.body.filters.dateFilter.endDate,
      lastUpdatedAt: '',
    },
    isEatsPassSubscriber: false,
    search: null,
    orderIssuesV2: [],
    issueOrderStatusFilter: [],
    displayByocIssues: false,
  });
  assert.match(request!.body.filters.dateFilter.startDate, /^\d{4}-\d{2}-01 00:00:00$/);
  assert.match(request!.body.filters.dateFilter.endDate, /^\d{4}-\d{2}-\d{2} 23:59:59$/);
  assert.deepEqual(request!.body.sort, { sortColumn: 'SORT_COLUMN_ORDER_COMPLETED_AT', sortDirection: 'SORT_DIRECTION_DESC' });
  assert.deepEqual(request!.body.pagingInfo, { cursor: 'page-2', limit: 20, nextTable: 'liveOrders' });
  assert.deepEqual(request!.body.pagination, { cursor: 'page-2', nextTable: 'historyOrders', limit: 20 });
  assert.equal(request!.headers.referer, 'https://merchants.ubereats.com/manager/orders?restaurantUUID=store-1');
  assert.equal(request!.headers['x-csrf-token'], 'x');
  assert.ok(request!.headers['x-feature-flags']);
  assert.equal(request!.headers.Cookie, 'session=value; selectedRestaurant=store-1');
});

test('keeps the required DoorDash detail request headers in the shared client', async () => {
  let headers: HeadersInit | undefined;
  const client = createMarketplaceProviderClient({
    getSession: async () => ({ provider: 'doordash', cookies: 'fixture', providerConfig: { storeId: 34, ddAttKey: 'key' }, updatedAt: null }),
    transport: async ({ init }) => {
      headers = init.headers;
      return new Response(JSON.stringify({ data: { orderId: 'DD-1', deliveryUuid: 'delivery-1' } }), { status: 200 });
    },
  });
  await client.getOrderDetail('doordash', 'delivery-1');
  assert.equal((headers as Record<string, string>)['client-version'], 'web version 2.0');
  assert.equal((headers as Record<string, string>)['origin-app'], 'merchant_portal');
});

test('restores DoorDash detail status timeline from provider timestamps', async () => {
  const client = createMarketplaceProviderClient({
    getSession: async () => ({ provider: 'doordash', cookies: 'fixture', providerConfig: { storeId: 34 }, updatedAt: null }),
    transport: async () => new Response(JSON.stringify({ data: { orderId: 'DD-1', deliveryUuid: 'delivery-1', actualPickupTime: '2026-08-25T01:02:03.000Z' } }), { status: 200 }),
  });
  const detail = await client.getOrderDetail('doordash', 'delivery-1');
  assert.deepEqual(detail.orderStateChanges, [{ changedAt: 1787619723000, orderState: 'PICKED_UP' }]);
});
