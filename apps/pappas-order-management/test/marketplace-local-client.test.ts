import assert from 'node:assert/strict';
import test from 'node:test';

import { createMarketplaceLocalClient } from '../lib/marketplace-local-client';

const session = { provider: 'uber_eats' as const, cookies: 'fixture', providerConfig: {}, updatedAt: null };

test('reuses the provider client session source across local active requests', async () => {
  let activeCalls = 0;
  const client = createMarketplaceLocalClient({
    getSessionBundle: async () => session,
    invalidate: () => undefined,
    createProviderClient: () => ({
      getActiveOrders: async () => { activeCalls += 1; return { provider: 'uber_eats', orders: [], nextCursor: null }; },
      getHistory: async () => ({ provider: 'uber_eats', orders: [], nextCursor: null }),
      getOrderDetail: async () => ({ provider: 'uber_eats', workflowUuid: 'wf', orderId: '', orderUUID: '' }),
    }),
  });
  await client.getActiveOrders('uber_eats');
  await client.getActiveOrders('uber_eats');
  assert.equal(activeCalls, 2);
});

test('refreshes once and retries once after a provider 401', async () => {
  let calls = 0;
  let invalidations = 0;
  const client = createMarketplaceLocalClient({
    getSessionBundle: async () => session,
    invalidate: () => { invalidations += 1; },
    createProviderClient: () => ({
      getActiveOrders: async () => { calls += 1; if (calls === 1) throw new Error('Uber Eats active orders request failed (401)'); return { provider: 'uber_eats', orders: [], nextCursor: null }; },
      getHistory: async () => ({ provider: 'uber_eats', orders: [], nextCursor: null }),
      getOrderDetail: async () => ({ provider: 'uber_eats', workflowUuid: 'wf', orderId: '', orderUUID: '' }),
    }),
  });
  await client.getActiveOrders('uber_eats');
  assert.equal(calls, 2);
  assert.equal(invalidations, 1);
});

test('does not retry a second provider 401', async () => {
  let calls = 0;
  const client = createMarketplaceLocalClient({
    getSessionBundle: async () => session,
    invalidate: () => undefined,
    createProviderClient: () => ({
      getActiveOrders: async () => { calls += 1; throw new Error('Uber Eats active orders request failed (401)'); },
      getHistory: async () => ({ provider: 'uber_eats', orders: [], nextCursor: null }),
      getOrderDetail: async () => ({ provider: 'uber_eats', workflowUuid: 'wf', orderId: '', orderUUID: '' }),
    }),
  });
  await assert.rejects(() => client.getActiveOrders('uber_eats'), /401/);
  assert.equal(calls, 2);
});
