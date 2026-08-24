import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_MARKETPLACE_SYNC_INTERVAL_SEC,
  normalizeMarketplaceSyncIntervalSec,
} from '../lib/marketplace-sync-interval';

test('defaults a device marketplace polling interval to 30 seconds', () => {
  assert.equal(DEFAULT_MARKETPLACE_SYNC_INTERVAL_SEC, 30);
  assert.equal(normalizeMarketplaceSyncIntervalSec(undefined), 30);
});

test('keeps marketplace polling intervals within the supported 15 to 600 second range', () => {
  assert.equal(normalizeMarketplaceSyncIntervalSec(5), 15);
  assert.equal(normalizeMarketplaceSyncIntervalSec(90), 90);
  assert.equal(normalizeMarketplaceSyncIntervalSec(900), 600);
});
