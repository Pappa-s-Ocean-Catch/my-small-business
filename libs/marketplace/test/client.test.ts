import assert from 'node:assert/strict';
import test from 'node:test';

import { createSessionCache, MARKETPLACE_SESSION_TTL_MS } from '../src/session-cache';

test('reuses a marketplace session for one hour', async () => {
  let calls = 0;
  const cache = createSessionCache({
    now: () => 1_000,
    load: async () => {
      calls += 1;
      return {
        provider: 'uber_eats' as const,
        cookies: 'session=fixture',
        providerConfig: {},
        updatedAt: null,
      };
    },
  });

  await cache.get('uber_eats');
  await cache.get('uber_eats');

  assert.equal(calls, 1);
  assert.equal(MARKETPLACE_SESSION_TTL_MS, 3_600_000);
});
