import { create } from 'zustand';

import type { MarketplaceOrderDetail } from '@/lib/marketplace';

export type MarketplacePosDraft = {
  provider: 'uber_eats' | 'doordash';
  sourceName: 'Uber Eats' | 'DoorDash';
  orderDetail: MarketplaceOrderDetail;
};

type MarketplacePosDraftState = {
  draft: MarketplacePosDraft | null;
  setDraft: (draft: MarketplacePosDraft) => void;
  clearDraft: () => void;
};

export const useMarketplacePosDraftStore = create<MarketplacePosDraftState>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  clearDraft: () => set({ draft: null }),
}));
