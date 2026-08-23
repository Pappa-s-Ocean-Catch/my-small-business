import { type PropsWithChildren } from 'react';

import { useAppSettingsQuery } from '@/hooks/useAppSettingsQuery';
import { MarketplaceSyncProvider } from '@/providers/MarketplaceSyncProvider';

export function MarketplaceSyncGate({
  authenticated,
  children,
}: PropsWithChildren<{ authenticated: boolean }>) {
  const { data: settings, isLoading } = useAppSettingsQuery();

  return (
    <MarketplaceSyncProvider enabled={authenticated && !isLoading && settings.marketplaceAutoSyncEnabled}>
      {children}
    </MarketplaceSyncProvider>
  );
}
