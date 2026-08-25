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
