import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-ignore Node's type-stripping test runner requires the source-file extension.
import { getMarketplaceExtensionCorsHeaders, isMarketplaceExtensionSecretValid, syncMarketplaceExtensionCredentials } from './marketplace-extension-sync.ts';

test('accepts only the configured marketplace extension secret', () => {
  assert.equal(isMarketplaceExtensionSecretValid('sync-secret', 'sync-secret'), true);
  assert.equal(isMarketplaceExtensionSecretValid('wrong-secret', 'sync-secret'), false);
  assert.equal(isMarketplaceExtensionSecretValid(null, 'sync-secret'), false);
});

test('allows CORS only for an explicitly configured extension origin', () => {
  const allowedOrigin = 'chrome-extension://hhiigboejidhghecamnmfimbljijmikk';

  assert.deepEqual(
    getMarketplaceExtensionCorsHeaders(allowedOrigin, allowedOrigin),
    {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Marketplace-Sync-Key',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    },
  );
  assert.deepEqual(getMarketplaceExtensionCorsHeaders('chrome-extension://other', allowedOrigin), {});
});

test('does not save a marketplace session when provider validation fails', async () => {
  let saveCalls = 0;
  const result = await syncMarketplaceExtensionCredentials({
    provider: 'uber_eats',
    cookies: 'sid=expired',
    validate: async () => ({ ok: false, error: 'Uber Eats session validation failed' }),
    save: async () => { saveCalls += 1; },
  });

  assert.deepEqual(result, { success: false, error: 'Uber Eats session validation failed' });
  assert.equal(saveCalls, 0);
});

test('saves a validated marketplace session with its existing provider configuration', async () => {
  let saved: unknown = null;
  const result = await syncMarketplaceExtensionCredentials({
    provider: 'doordash',
    cookies: 'sid=valid',
    validate: async () => ({ ok: true, providerConfig: { businessId: '123', storeId: '456' } }),
    save: async (input) => { saved = input; },
  });

  assert.deepEqual(result, { success: true });
  assert.deepEqual(saved, {
    provider: 'doordash',
    cookies: 'sid=valid',
    providerConfig: { businessId: '123', storeId: '456' },
  });
});
