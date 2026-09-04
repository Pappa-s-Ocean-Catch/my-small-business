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
import type { MarketplaceSyncWindow } from '@/lib/marketplace-sync-window';
import { formatPerformanceDuration, isSlowOperation } from '@/lib/performance-trace';

type MarketplaceSyncProviderProps = PropsWithChildren<{
  enabled: boolean;
  intervalMs: number;
  syncWindow: MarketplaceSyncWindow;
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
  syncWindow,
}: MarketplaceSyncProviderProps) {
  const coordinator = useMemo(() => createMarketplaceSyncCoordinator({
    getActiveOrders: (provider) => getMarketplaceActiveOrders(provider, undefined, 'auto-sync'),
    getOrderDetail: getMarketplaceOrderDetail,
    importMarketplaceOrder,
    getOpenMarketplaceOrdersForHistory,
    syncMarketplaceOrderStatus,
    canPoll: () => isMarketplaceAutoSyncOpenAt(new Date(), syncWindow),
    intervalMs,
    logError: (message, error) => {
      usePrinterAutomationStore.getState().addJournalEntry({
        level: 'decision',
        scope: 'marketplace-sync',
        message,
        details: `reason=${marketplaceSyncErrorDetails(error)}`,
      });
      console.error(message, error);
    },
    onProviderPollSuccess: (provider) => marketplaceSyncAlertStore.getState().clear(provider),
    onProviderPollFailure: (provider) => marketplaceSyncAlertStore.getState().reportFailure(provider),
    onPollComplete: (durationMs) => {
      if (!isSlowOperation(durationMs)) return;
      usePrinterAutomationStore.getState().addJournalEntry({
        level: 'error',
        scope: 'performance',
        message: 'Marketplace sync poll was slow',
        details: `duration=${formatPerformanceDuration(durationMs)}`,
      });
    },
  }), [intervalMs, syncWindow.endTime, syncWindow.startTime]);

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
