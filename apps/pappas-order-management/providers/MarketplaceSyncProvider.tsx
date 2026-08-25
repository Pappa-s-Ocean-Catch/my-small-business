import { useEffect, useMemo, type PropsWithChildren } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  createMarketplaceSyncCoordinator,
  getMarketplaceActiveOrders,
  getMarketplaceOrderDetail,
  isMarketplaceAutoSyncOpenAt,
} from '@/lib/marketplace';
import {
  importMarketplaceOrder,
  syncMarketplaceOrderStatus,
} from '@/lib/marketplace-pos-order';
import { getOpenMarketplaceOrdersForHistory } from '@/lib/orders';
import { MarketplaceSyncAlertBanner } from '@/components/MarketplaceSyncAlertBanner';
import { marketplaceSyncAlertStore } from '@/stores/marketplaceSyncAlertStore';
import { usePrinterAutomationStore } from '@/stores/printerAutomationStore';

type MarketplaceSyncProviderProps = PropsWithChildren<{
  enabled: boolean;
  intervalMs: number;
}>;

function marketplaceSyncErrorDetails(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(cookie|authorization|token)=?[^\s;]*/gi, '$1=[redacted]')
    .slice(0, 500);
}

export function MarketplaceSyncProvider({
  children,
  enabled,
  intervalMs,
}: MarketplaceSyncProviderProps) {
  const coordinator = useMemo(() => createMarketplaceSyncCoordinator({
    getActiveOrders: (provider) => getMarketplaceActiveOrders(provider, undefined, 'auto-sync'),
    getOrderDetail: getMarketplaceOrderDetail,
    importMarketplaceOrder,
    getOpenMarketplaceOrdersForHistory,
    syncMarketplaceOrderStatus,
    canPoll: () => isMarketplaceAutoSyncOpenAt(new Date()),
    intervalMs,
    logError: (message, error) => {
      usePrinterAutomationStore.getState().addJournalEntry({
        level: 'error',
        scope: 'marketplace-sync',
        message,
        details: `reason=${marketplaceSyncErrorDetails(error)}`,
      });
      console.error(message, error);
    },
    onProviderPollSuccess: (provider) => marketplaceSyncAlertStore.getState().clear(provider),
    onProviderPollFailure: (provider) => marketplaceSyncAlertStore.getState().reportFailure(provider),
  }), [intervalMs]);

  useEffect(() => {
    if (!enabled) {
      coordinator.stop();
      marketplaceSyncAlertStore.getState().clear('uber_eats');
      marketplaceSyncAlertStore.getState().clear('doordash');
      return;
    }

    const updateForAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        void coordinator.start();
      } else {
        coordinator.stop();
      }
    };

    updateForAppState(AppState.currentState);
    const subscription = AppState.addEventListener('change', updateForAppState);

    return () => {
      subscription.remove();
      coordinator.stop();
    };
  }, [coordinator, enabled]);

  return <>{children}<MarketplaceSyncAlertBanner /></>;
}
