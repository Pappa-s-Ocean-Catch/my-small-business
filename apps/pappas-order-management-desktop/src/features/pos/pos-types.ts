import type { CatalogCategory, CatalogProduct, CatalogSnapshot } from '@my-small-business/pos-domain';

export type DesktopCatalogCategory = CatalogCategory & {
  parent_category_id?: string | null;
};

export type DesktopCatalogProduct = CatalogProduct & {
  description?: string | null;
  image_url?: string | null;
  sale_price?: number | string | null;
  salePriceCents: number;
};

export type AddonItem = {
  id: string;
  addon_group_id: string;
  name: string;
  extra_price: number;
  sort_order: number | null;
  is_active: boolean | null;
};

export type AddonGroup = {
  id: string;
  name: string;
  is_required: boolean;
  multiple_choice: boolean;
  display_order: number | null;
  items: AddonItem[];
};

export type RemovableIngredient = {
  id: string;
  ingredient_name: string;
  customer_can_remove: boolean;
};

export type CustomizationData = {
  groups: AddonGroup[];
  removableIngredients: RemovableIngredient[];
};

export type DesktopCatalogSnapshot = CatalogSnapshot<DesktopCatalogCategory, DesktopCatalogProduct> & {
  customizations: Map<string, CustomizationData>;
};

export type OrderItemAddon = {
  addon_item_id: string;
  addon_item_name?: string | null;
  addon_item_price?: number | null;
  quantity?: number;
};

export type CartLine = {
  id: string;
  productId: string;
  name: string;
  salePriceCents: number;
  quantity: number;
  addons: OrderItemAddon[];
  removedIngredients: string[];
  notes: string;
};
