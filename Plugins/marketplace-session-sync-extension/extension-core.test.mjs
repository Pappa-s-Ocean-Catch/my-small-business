import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCookieHeaderFromRequestHeaders,
  getProviderForRequestUrl,
  getProviderForUrl,
} from './extension-core.mjs';

test('recognizes only supported marketplace portal URLs', () => {
  assert.equal(getProviderForUrl('https://merchants.ubereats.com/manager/orders'), 'uber_eats');
  assert.equal(getProviderForUrl('https://www.doordash.com/merchant/orders'), 'doordash');
  assert.equal(getProviderForUrl('https://example.com/merchant/orders'), null);
});

test('recognizes only the approved marketplace API request patterns', () => {
  assert.equal(
    getProviderForRequestUrl('https://merchants.ubereats.com/manager/api/getActiveOrders'),
    'uber_eats',
  );
  assert.equal(
    getProviderForRequestUrl('https://merchant-portal.doordash.com/merchant-analytics-service/api/v1/get_orders'),
    'doordash',
  );
  assert.equal(getProviderForRequestUrl('https://www.doordash.com/merchant/orders'), null);
});

test('extracts only the Cookie header from a captured marketplace request', () => {
  assert.equal(
    getCookieHeaderFromRequestHeaders([{ name: 'accept', value: '*/*' }, { name: 'Cookie', value: 'sid=abc; x=1' }]),
    'sid=abc; x=1',
  );
  assert.equal(getCookieHeaderFromRequestHeaders([{ name: 'authorization', value: 'Bearer token' }]), '');
});
