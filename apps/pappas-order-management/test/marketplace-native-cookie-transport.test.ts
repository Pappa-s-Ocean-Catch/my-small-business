import assert from 'node:assert/strict';
import test from 'node:test';

import { createMarketplaceCookieStoreTransport } from '../lib/marketplace-native-cookie-transport-core';

test('uses the native cookie store instead of a manually supplied Cookie header and restores existing cookies', async () => {
  const events: string[] = [];
  let requestHeaders: Headers | undefined;
  const transport = createMarketplaceCookieStoreTransport({
    cookieStore: {
      getAsArray: async () => [{ name: 'sid', value: 'preserve', path: '/', secure: true }],
      set: async (_url, cookie) => { events.push(`set:${cookie.name}=${cookie.value}`); return true; },
      clearByName: async (_url, name) => { events.push(`clear:${name}`); return true; },
    },
    fetch: async (_url, init) => {
      requestHeaders = new Headers(init.headers);
      return new Response('{}', { status: 200 });
    },
  });

  await transport({
    url: 'https://merchants.ubereats.com/manager/api/getActiveOrders',
    init: { headers: { Cookie: 'sid=abc; selectedRestaurant=store-1', 'x-csrf-token': 'x' } },
  });

  assert.equal(requestHeaders?.has('cookie'), false);
  assert.equal(requestHeaders?.get('x-csrf-token'), 'x');
  assert.deepEqual(events, [
    'set:sid=abc',
    'set:selectedRestaurant=store-1',
    'clear:sid',
    'clear:selectedRestaurant',
    'set:sid=preserve',
  ]);
});

test('leaves requests without a Cookie header untouched', async () => {
  let cookieStoreUsed = false;
  const transport = createMarketplaceCookieStoreTransport({
    cookieStore: {
      getAsArray: async () => { cookieStoreUsed = true; return []; },
      set: async () => true,
      clearByName: async () => true,
    },
    fetch: async (_url, init) => new Response(String(new Headers(init.headers).get('accept')), { status: 200 }),
  });

  const response = await transport({ url: 'https://merchant-portal.doordash.com/orders', init: { headers: { accept: 'application/json' } } });
  assert.equal(await response.text(), 'application/json');
  assert.equal(cookieStoreUsed, false);
});
