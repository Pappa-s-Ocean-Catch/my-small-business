import assert from 'node:assert/strict';
import test from 'node:test';

import { createMarketplaceActiveClient } from '../src/active-client';

test('uses the cached Uber session for a direct active request', async () => {
  let requestedUrl = '';
  let headers: HeadersInit | undefined;
  const client = createMarketplaceActiveClient({
    getSession: async () => ({ provider: 'uber_eats', cookies: 'selectedRestaurant=store-1', providerConfig: {}, updatedAt: null }),
    fetch: async (url: string, init: RequestInit) => {
      requestedUrl = url;
      headers = init.headers;
      return new Response(JSON.stringify({ status: 'success', data: { rows: [{ orderId: 'UE-1', workflowUuid: 'wf-1' }] } }), { status: 200 });
    },
  });
  assert.equal((await client.getActiveOrders('uber_eats')).orders[0].workflowUuid, 'wf-1');
  assert.match(requestedUrl, /getActiveOrders/);
  assert.equal((headers as Record<string, string>)['x-feature-flags']?.includes('OrdersList'), true);
  assert.equal((headers as Record<string, string>)['cache-control'], 'no-cache');
  assert.equal((headers as Record<string, string>).pragma, 'no-cache');
  assert.match((headers as Record<string, string>)['sec-ch-ua'], /Chromium";v="151/);
  assert.match((headers as Record<string, string>)['user-agent'], /Chrome\/151\.0\.0\.0/);
});

test('logs a safe Uber active response summary without provider session data', async () => {
  const originalInfo = console.info;
  const logs: unknown[][] = [];
  console.info = (...args: unknown[]) => { logs.push(args); };
  try {
    const client = createMarketplaceActiveClient({
      getSession: async () => ({ provider: 'uber_eats', cookies: 'secret-cookie; selectedRestaurant=store-1', providerConfig: {}, updatedAt: null }),
      fetch: async () => new Response(JSON.stringify({ status: 'success', data: { rows: [] } }), { status: 200 }),
    });
    await client.getActiveOrders('uber_eats');
  } finally {
    console.info = originalInfo;
  }
  assert.deepEqual(logs, [['[marketplace]', { provider: 'uber_eats', operation: 'active', status: 200, providerRows: 0, rows: 0 }]]);
});

test('does not send a stale DoorDash ATT key with an active-order list request', async () => {
  let headers: HeadersInit | undefined;
  const client = createMarketplaceActiveClient({
    getSession: async () => ({ provider: 'doordash', cookies: 'fixture', providerConfig: { businessId: 12, storeId: 34, ddAttKey: 'stale-key' }, updatedAt: null }),
    fetch: async (_url, init) => {
      headers = init.headers;
      return new Response(JSON.stringify({ orders: [] }), { status: 200 });
    },
  });

  await client.getActiveOrders('doordash');
  assert.equal((headers as Record<string, string>)['dd-att-key'], undefined);
});
