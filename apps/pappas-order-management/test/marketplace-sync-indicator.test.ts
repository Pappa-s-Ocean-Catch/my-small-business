import assert from 'node:assert/strict';
import test from 'node:test';

import { getMarketplaceSyncIndicatorColor } from '../lib/marketplace-sync-indicator';

test('uses white for an enabled marketplace sync with no provider errors', () => {
  assert.equal(getMarketplaceSyncIndicatorColor(true, false), '#ffffff');
});

test('uses red for an enabled marketplace sync with a provider error', () => {
  assert.equal(getMarketplaceSyncIndicatorColor(true, true), '#ff0000');
});

test('uses a dim blue-grey when marketplace sync is disabled on this device', () => {
  assert.equal(getMarketplaceSyncIndicatorColor(false, true), '#6b7fa8');
});
