import { useEffect, useMemo, type PropsWithChildren } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  createMarketplaceSyncCoordinator,
  getMarketplaceActiveOrders,
  getMarketplaceOrderDetail,
} from '@/lib/marketplace';
import {
  importMarketplaceOrder,
  syncMarketplaceOrderStatus,
} from '@/lib/marketplace-pos-order';
import { getOpenMarketplaceOrdersForHistory } from '@/lib/orders';

type MarketplaceSyncProviderProps = PropsWithChildren<{
  enabled: boolean;
}>;

export function MarketplaceSyncProvider({
  children,
  enabled,
}: MarketplaceSyncProviderProps) {
  const coordinator = useMemo(() => createMarketplaceSyncCoordinator({
    getActiveOrders: getMarketplaceActiveOrders,
    getOrderDetail: getMarketplaceOrderDetail,
    importMarketplaceOrder,
    getOpenMarketplaceOrdersForHistory,
    syncMarketplaceOrderStatus,
  }), []);

  useEffect(() => {
    if (!enabled) {
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
  }, [coordinator, enabled]);

  return children;
}
