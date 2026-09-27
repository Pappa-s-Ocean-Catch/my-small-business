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

type ProviderSyncOptions = {
  enabled: boolean;
  intervalMs: number;
};

type MarketplaceSyncProviderProps = PropsWithChildren<{
  enabled?: boolean;
  intervalMs?: number;
  doorDash?: ProviderSyncOptions;
  uberEats?: ProviderSyncOptions;
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
  enabled = true,
  intervalMs,
  doorDash,
  uberEats,
  syncWindow,
}: MarketplaceSyncProviderProps) {
  const doorDashEnabled = doorDash ? doorDash.enabled : enabled;
  const doorDashIntervalMs = doorDash?.intervalMs ?? intervalMs ?? 30_000;
  const uberEatsEnabled = uberEats ? uberEats.enabled : enabled;
  const uberEatsIntervalMs = uberEats?.intervalMs ?? intervalMs ?? 30_000;

  const coordinator = useMemo(() => createMarketplaceSyncCoordinator({
    getActiveOrders: (provider) => getMarketplaceActiveOrders(provider, undefined, 'auto-sync'),
    getOrderDetail: getMarketplaceOrderDetail,
    importMarketplaceOrder,
    getOpenMarketplaceOrdersForHistory,
    syncMarketplaceOrderStatus,
    canPoll: (provider) => {
      if (provider === 'doordash' && !doorDashEnabled) return false;
      if (provider === 'uber_eats' && !uberEatsEnabled) return false;
      return isMarketplaceAutoSyncOpenAt(new Date(), syncWindow);
    },
    providerConfig: {
      doordash: {
        enabled: doorDashEnabled,
        intervalMs: doorDashIntervalMs,
      },
      uber_eats: {
        enabled: uberEatsEnabled,
        intervalMs: uberEatsIntervalMs,
      },
    },
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
    onPollComplete: (durationMs, provider) => {
      if (!isSlowOperation(durationMs)) return;
      usePrinterAutomationStore.getState().addJournalEntry({
        level: 'error',
        scope: 'performance',
        message: `Marketplace sync poll was slow (${provider || 'all'})`,
        details: `duration=${formatPerformanceDuration(durationMs)}`,
      });
    },
  }), [
    doorDashEnabled,
    doorDashIntervalMs,
    uberEatsEnabled,
    uberEatsIntervalMs,
    syncWindow.endTime,
    syncWindow.startTime,
  ]);

  useEffect(() => {
    if (!doorDashEnabled) {
      coordinator.stop('doordash');
      marketplaceSyncAlertStore.getState().clear('doordash');
    }
    if (!uberEatsEnabled) {
      coordinator.stop('uber_eats');
      marketplaceSyncAlertStore.getState().clear('uber_eats');
    }

    if (!doorDashEnabled && !uberEatsEnabled) {
      coordinator.stop();
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
  }, [coordinator, doorDashEnabled, uberEatsEnabled]);

  return <>{children}<MarketplaceSyncAlertBanner /></>;
}
