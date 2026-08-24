import assert from 'node:assert/strict';
import test from 'node:test';

import { createMarketplaceActiveClient } from '../src/active-client';

test('uses the cached Uber session for a direct active request', async () => {
  let requestedUrl = '';
  const client = createMarketplaceActiveClient({
    getSession: async () => ({ provider: 'uber_eats', cookies: 'selectedRestaurant=store-1', providerConfig: {}, updatedAt: null }),
    fetch: async (url: string) => {
      requestedUrl = url;
      return new Response(JSON.stringify({ status: 'success', data: { rows: [{ orderId: 'UE-1', workflowUuid: 'wf-1' }] } }), { status: 200 });
    },
  });
  assert.equal((await client.getActiveOrders('uber_eats')).orders[0].workflowUuid, 'wf-1');
  assert.match(requestedUrl, /getActiveOrders/);
});
