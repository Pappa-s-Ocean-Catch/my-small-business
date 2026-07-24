import type { OrderItem, OrderItemAddon } from '@my-small-business/types';

export type SaleCategory = {
  id: string;
  name: string;
  section?: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  parent_category_id: string | null;
};

export type SaleProduct = {
  id: string;
  name: string;
  description: string | null;
  section?: string | null;
  search_term: string | null;
  sale_price: number;
  image_url: string | null;
  sale_category_id: string | null;
  sub_category_id: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

export type TopSellerProduct = SaleProduct & {
  total_quantity_sold: number;
  total_orders: number;
};

export type AddonItem = {
  id: string;
  addon_group_id: string;
  name: string;
  extra_price: number;
  section?: string | null;
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
};

export type PosCartItem = OrderItem & {
  id: string;
  addons: OrderItemAddon[];
};

export type PosPaymentChoice = 'card' | 'cash' | 'no_pay';
export type PosInstorePaymentChoice = 'card' | 'cash' | 'unpaid';
export type PosCheckoutPaymentOverride = PosPaymentChoice | 'smartpay';
export type CashTenderMode = 'pickup' | 'instore';
export type PosThirdPartySource = 'Uber Eats' | 'DoorDash';

export type LayoutCategoryButton = {
  id: string;
  name: string;
  color: string;
  showProductsOnTopLevel: boolean;
};

export type CacheEntry<T> = {
  expiresAt: number;
  data: T;
};

export type CustomizationData = {
  groups: AddonGroup[];
  removableIngredients: RemovableIngredient[];
};
