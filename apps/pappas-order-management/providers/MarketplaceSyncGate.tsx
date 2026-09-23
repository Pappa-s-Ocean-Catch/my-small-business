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

  return (
    <MarketplaceSyncProvider
      enabled={authenticated && Boolean(catalog) && !isLoading && settings.marketplaceAutoSyncEnabled}
      intervalMs={settings.marketplaceSyncIntervalSec * 1_000}
      syncWindow={{
        startTime: settings.marketplaceSyncStartTime,
        endTime: settings.marketplaceSyncEndTime,
      }}
    >
      {children}
    </MarketplaceSyncProvider>
  );
}
