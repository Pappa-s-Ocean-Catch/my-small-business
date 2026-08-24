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

type MarketplaceSyncProviderProps = PropsWithChildren<{
  enabled: boolean;
  intervalMs: number;
}>;

export function MarketplaceSyncProvider({
  children,
  enabled,
  intervalMs,
}: MarketplaceSyncProviderProps) {
  const coordinator = useMemo(() => createMarketplaceSyncCoordinator({
    getActiveOrders: getMarketplaceActiveOrders,
    getOrderDetail: getMarketplaceOrderDetail,
    importMarketplaceOrder,
    getOpenMarketplaceOrdersForHistory,
    syncMarketplaceOrderStatus,
    canPoll: () => isMarketplaceAutoSyncOpenAt(new Date()),
    intervalMs,
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
