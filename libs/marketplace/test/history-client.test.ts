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
