import { create } from 'zustand';

import type { MarketplaceOrderDetail } from '@/lib/marketplace';

export type MarketplacePosDraft = {
  provider: 'uber_eats' | 'doordash';
  sourceName: 'Uber Eats' | 'DoorDash';
  orderDetail: MarketplaceOrderDetail;
};

export type MarketplaceMappingEdit = {
  id: string;
  provider: 'uber_eats' | 'doordash';
  entityType: 'product' | 'addon_group' | 'addon' | 'ingredient';
  externalName: string;
  normalizedExternalName: string;
  parentNormalizedExternalName: string;
  internalName: string;
  internalEntityId: string | null;
};

type MarketplacePosDraftState = {
  draft: MarketplacePosDraft | null;
  mappingEdit: MarketplaceMappingEdit | null;
  setDraft: (draft: MarketplacePosDraft) => void;
  clearDraft: () => void;
  setMappingEdit: (mapping: MarketplaceMappingEdit) => void;
  clearMappingEdit: () => void;
};

export const useMarketplacePosDraftStore = create<MarketplacePosDraftState>((set) => ({
  draft: null,
  mappingEdit: null,
  setDraft: (draft) => set({ draft }),
  clearDraft: () => set({ draft: null }),
  setMappingEdit: (mappingEdit) => set({ mappingEdit }),
  clearMappingEdit: () => set({ mappingEdit: null }),
}));
