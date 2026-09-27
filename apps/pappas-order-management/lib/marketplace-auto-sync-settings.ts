import {
  DEFAULT_MARKETPLACE_SYNC_INTERVAL_SEC,
  normalizeMarketplaceSyncIntervalSec,
} from './marketplace-sync-interval';
import {
  normalizeMarketplaceSyncWindow,
} from './marketplace-sync-window';

export type MarketplaceFetchMode = 'api' | 'local';

export type MarketplaceAutoSyncSettings = {
  marketplaceAutoSyncEnabled: boolean;
  marketplaceSyncIntervalSec: number;
  marketplaceDoorDashSyncEnabled: boolean;
  marketplaceDoorDashSyncIntervalSec: number;
  marketplaceUberSyncEnabled: boolean;
  marketplaceUberSyncIntervalSec: number;
  marketplaceSyncStartTime: string;
  marketplaceSyncEndTime: string;
  marketplaceFetchMode: MarketplaceFetchMode;
};

export const DEFAULT_MARKETPLACE_AUTO_SYNC_SETTINGS: MarketplaceAutoSyncSettings = {
  marketplaceAutoSyncEnabled: true,
  marketplaceSyncIntervalSec: DEFAULT_MARKETPLACE_SYNC_INTERVAL_SEC,
  marketplaceDoorDashSyncEnabled: true,
  marketplaceDoorDashSyncIntervalSec: DEFAULT_MARKETPLACE_SYNC_INTERVAL_SEC,
  marketplaceUberSyncEnabled: true,
  marketplaceUberSyncIntervalSec: DEFAULT_MARKETPLACE_SYNC_INTERVAL_SEC,
  marketplaceSyncStartTime: '11:00',
  marketplaceSyncEndTime: '20:30',
  marketplaceFetchMode: 'api',
};

export function normalizeMarketplaceAutoSyncSettings(
  input: unknown
): MarketplaceAutoSyncSettings {
  const parsed = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;

  const legacyEnabled = typeof parsed.marketplaceAutoSyncEnabled === 'boolean'
    ? parsed.marketplaceAutoSyncEnabled
    : true;
  const legacyInterval = normalizeMarketplaceSyncIntervalSec(parsed.marketplaceSyncIntervalSec);

  const marketplaceDoorDashSyncEnabled = typeof parsed.marketplaceDoorDashSyncEnabled === 'boolean'
    ? parsed.marketplaceDoorDashSyncEnabled
    : legacyEnabled;

  const marketplaceUberSyncEnabled = typeof parsed.marketplaceUberSyncEnabled === 'boolean'
    ? parsed.marketplaceUberSyncEnabled
    : legacyEnabled;

  const marketplaceDoorDashSyncIntervalSec = normalizeMarketplaceSyncIntervalSec(
    parsed.marketplaceDoorDashSyncIntervalSec ?? legacyInterval
  );

  const marketplaceUberSyncIntervalSec = normalizeMarketplaceSyncIntervalSec(
    parsed.marketplaceUberSyncIntervalSec ?? legacyInterval
  );

  const syncWindow = normalizeMarketplaceSyncWindow({
    startTime: typeof parsed.marketplaceSyncStartTime === 'string' ? parsed.marketplaceSyncStartTime : undefined,
    endTime: typeof parsed.marketplaceSyncEndTime === 'string' ? parsed.marketplaceSyncEndTime : undefined,
  });

  const marketplaceFetchMode: MarketplaceFetchMode = parsed.marketplaceFetchMode === 'local' ? 'local' : 'api';

  return {
    marketplaceAutoSyncEnabled: marketplaceDoorDashSyncEnabled || marketplaceUberSyncEnabled,
    marketplaceSyncIntervalSec: Math.min(marketplaceDoorDashSyncIntervalSec, marketplaceUberSyncIntervalSec),
    marketplaceDoorDashSyncEnabled,
    marketplaceDoorDashSyncIntervalSec,
    marketplaceUberSyncEnabled,
    marketplaceUberSyncIntervalSec,
    marketplaceSyncStartTime: syncWindow.startTime,
    marketplaceSyncEndTime: syncWindow.endTime,
    marketplaceFetchMode,
  };
}
