import { create } from 'zustand';

export type MarketplaceAlertProvider = 'uber_eats' | 'doordash';

type MarketplaceSyncAlert = {
  id: number;
  visible: boolean;
};

type MarketplaceSyncAlertState = {
  alerts: Partial<Record<MarketplaceAlertProvider, MarketplaceSyncAlert>>;
  reportFailure: (provider: MarketplaceAlertProvider) => void;
  dismiss: (provider: MarketplaceAlertProvider) => void;
  clear: (provider: MarketplaceAlertProvider) => void;
};

export const marketplaceSyncAlertStore = create<MarketplaceSyncAlertState>((set) => ({
  alerts: {},
  reportFailure: (provider) => set((state) => ({
    alerts: {
      ...state.alerts,
      [provider]: { id: (state.alerts[provider]?.id ?? 0) + 1, visible: true },
    },
  })),
  dismiss: (provider) => set((state) => ({
    alerts: state.alerts[provider]
      ? { ...state.alerts, [provider]: { ...state.alerts[provider], visible: false } }
      : state.alerts,
  })),
  clear: (provider) => set((state) => {
    const { [provider]: _ignored, ...alerts } = state.alerts;
    return { alerts };
  }),
}));
