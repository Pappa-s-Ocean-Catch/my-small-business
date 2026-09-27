import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_MARKETPLACE_AUTO_SYNC_SETTINGS,
  normalizeMarketplaceAutoSyncSettings,
} from '../lib/marketplace-auto-sync-settings';

test('defaults marketplace auto-sync to enabled per tablet with per-provider settings', () => {
  assert.equal(DEFAULT_MARKETPLACE_AUTO_SYNC_SETTINGS.marketplaceAutoSyncEnabled, true);
  assert.equal(DEFAULT_MARKETPLACE_AUTO_SYNC_SETTINGS.marketplaceSyncIntervalSec, 30);
  assert.equal(DEFAULT_MARKETPLACE_AUTO_SYNC_SETTINGS.marketplaceDoorDashSyncEnabled, true);
  assert.equal(DEFAULT_MARKETPLACE_AUTO_SYNC_SETTINGS.marketplaceDoorDashSyncIntervalSec, 30);
  assert.equal(DEFAULT_MARKETPLACE_AUTO_SYNC_SETTINGS.marketplaceUberSyncEnabled, true);
  assert.equal(DEFAULT_MARKETPLACE_AUTO_SYNC_SETTINGS.marketplaceUberSyncIntervalSec, 30);
  assert.equal(DEFAULT_MARKETPLACE_AUTO_SYNC_SETTINGS.marketplaceSyncStartTime, '11:00');
  assert.equal(DEFAULT_MARKETPLACE_AUTO_SYNC_SETTINGS.marketplaceSyncEndTime, '20:30');
  assert.equal(DEFAULT_MARKETPLACE_AUTO_SYNC_SETTINGS.marketplaceFetchMode, 'api');
});

test('migrates legacy marketplaceAutoSyncEnabled preference to both providers', () => {
  const normalizedDisabled = normalizeMarketplaceAutoSyncSettings({
    marketplaceAutoSyncEnabled: false,
    marketplaceSyncIntervalSec: 60,
  });
  assert.equal(normalizedDisabled.marketplaceDoorDashSyncEnabled, false);
  assert.equal(normalizedDisabled.marketplaceDoorDashSyncIntervalSec, 60);
  assert.equal(normalizedDisabled.marketplaceUberSyncEnabled, false);
  assert.equal(normalizedDisabled.marketplaceUberSyncIntervalSec, 60);
  assert.equal(normalizedDisabled.marketplaceAutoSyncEnabled, false);

  const normalizedEnabled = normalizeMarketplaceAutoSyncSettings({
    marketplaceAutoSyncEnabled: true,
  });
  assert.equal(normalizedEnabled.marketplaceDoorDashSyncEnabled, true);
  assert.equal(normalizedEnabled.marketplaceUberSyncEnabled, true);
  assert.equal(normalizedEnabled.marketplaceAutoSyncEnabled, true);
});

test('allows independent configuration for DoorDash and Uber Eats', () => {
  const normalized = normalizeMarketplaceAutoSyncSettings({
    marketplaceDoorDashSyncEnabled: true,
    marketplaceDoorDashSyncIntervalSec: 5,
    marketplaceUberSyncEnabled: false,
    marketplaceUberSyncIntervalSec: 120,
  });

  assert.equal(normalized.marketplaceDoorDashSyncEnabled, true);
  assert.equal(normalized.marketplaceDoorDashSyncIntervalSec, 5);
  assert.equal(normalized.marketplaceUberSyncEnabled, false);
  assert.equal(normalized.marketplaceUberSyncIntervalSec, 120);
  assert.equal(normalized.marketplaceAutoSyncEnabled, true);
  assert.equal(normalized.marketplaceSyncIntervalSec, 5);
});
