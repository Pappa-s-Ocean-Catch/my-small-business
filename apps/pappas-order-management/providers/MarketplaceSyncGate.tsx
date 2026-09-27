import { type PropsWithChildren } from 'react';

import { useAppSettingsQuery } from '@/hooks/useAppSettingsQuery';
import { MarketplaceSyncProvider } from '@/providers/MarketplaceSyncProvider';
import { usePosCatalog } from '@/providers/PosCatalogProvider';

export function MarketplaceSyncGate({
  authenticated,
  children,
}: PropsWithChildren<{ authenticated: boolean }>) {
  const { data: settings, isLoading } = useAppSettingsQuery();
  const { snapshot: catalog } = usePosCatalog();

  const isReady = authenticated && Boolean(catalog) && !isLoading;

  return (
    <MarketplaceSyncProvider
      enabled={isReady && settings.marketplaceAutoSyncEnabled}
      intervalMs={settings.marketplaceSyncIntervalSec * 1_000}
      doorDash={{
        enabled: isReady && settings.marketplaceDoorDashSyncEnabled,
        intervalMs: settings.marketplaceDoorDashSyncIntervalSec * 1_000,
      }}
      uberEats={{
        enabled: isReady && settings.marketplaceUberSyncEnabled,
        intervalMs: settings.marketplaceUberSyncIntervalSec * 1_000,
      }}
      syncWindow={{
        startTime: settings.marketplaceSyncStartTime,
        endTime: settings.marketplaceSyncEndTime,
      }}
    >
      {children}
    </MarketplaceSyncProvider>
  );
}
