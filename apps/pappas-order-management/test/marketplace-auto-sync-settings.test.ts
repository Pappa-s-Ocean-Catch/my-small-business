import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { DEFAULT_APP_SETTINGS } from '../lib/settings';

test('defaults marketplace auto-sync to enabled per tablet', () => {
  assert.equal(DEFAULT_APP_SETTINGS.marketplaceAutoSyncEnabled, true);
  assert.equal(DEFAULT_APP_SETTINGS.marketplaceSyncIntervalSec, 30);
  assert.equal(DEFAULT_APP_SETTINGS.marketplaceSyncStartTime, '11:00');
  assert.equal(DEFAULT_APP_SETTINGS.marketplaceSyncEndTime, '20:30');
  assert.equal(DEFAULT_APP_SETTINGS.marketplaceFetchMode, 'api');
});

test('Settings exposes and persists the marketplace auto-sync preference', () => {
  const source = readFileSync(resolve(
    __dirname,
    '../../../../app/(drawer)/(tabs)/settings.tsx',
  ), 'utf8');

  assert.match(source, /Marketplace auto-sync/);
  assert.match(source, /marketplaceAutoSyncEnabled/);
  assert.match(source, /Marketplace polling interval \(seconds\)/);
  assert.match(source, /marketplaceSyncIntervalSec/);
});
