import type { OrderItem } from '@my-small-business/types';

export type PosPromotion = {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  applies_to: 'product' | 'cart';
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  starts_at: string | null;
  ends_at: string | null;
  days_of_week: number[] | null;
  daily_start_minute: number | null;
  daily_end_minute: number | null;
  product_scope: 'all' | 'specific' | 'min_price';
  min_product_price: number | null;
  cart_scope: 'all' | 'subtotal_min';
  min_cart_subtotal: number | null;
  priority: number;
  product_ids?: string[];
};

export type PosPromotionCartItem = Pick<OrderItem, 'product_id' | 'product_name' | 'base_price' | 'quantity' | 'subtotal'> & {
  id?: string;
};

export type PosAppliedPromotion = {
  id: string;
  title: string;
  applies_to: 'product' | 'cart';
  amount: number;
  kind?: 'standard' | 'free_item';
  selected_item_id?: string;
  selected_item_name?: string;
  threshold?: number | null;
};

export type PosFreeItemPromotionMatch = {
  promotion: PosPromotion;
  item: PosPromotionCartItem;
  unitPrice: number;
  discountAmount: number;
};

export function clampCurrency(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100) / 100);
}

export function isPromotionActiveNow(
  promo: Pick<PosPromotion, 'is_active' | 'starts_at' | 'ends_at' | 'days_of_week' | 'daily_start_minute' | 'daily_end_minute'>,
  now: Date = new Date(),
): boolean {
  if (!promo.is_active) return false;
  if (promo.starts_at) {
    const starts = new Date(promo.starts_at);
    if (!Number.isNaN(starts.getTime()) && now < starts) return false;
  }
  if (promo.ends_at) {
    const ends = new Date(promo.ends_at);
    if (!Number.isNaN(ends.getTime()) && now > ends) return false;
  }

  const weekday = now.getDay();
  if (promo.days_of_week?.length && !promo.days_of_week.includes(weekday)) return false;

  const startMin = promo.daily_start_minute;
  const endMin = promo.daily_end_minute;
  if (startMin != null && endMin != null) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (startMin <= endMin) {
      if (nowMin < startMin || nowMin > endMin) return false;
    } else if (!(nowMin >= startMin || nowMin <= endMin)) {
      return false;
    }
  }

  return true;
}

export function isFreeItemPromotion(promo: PosPromotion): boolean {
  return promo.applies_to === 'cart' && Array.isArray(promo.product_ids) && promo.product_ids.length > 0;
}

export function appliesToCart(promo: PosPromotion, cartSubtotal: number): boolean {
  if (promo.applies_to !== 'cart') return false;
  if (promo.cart_scope === 'subtotal_min') {
    const min = Number(promo.min_cart_subtotal ?? 0) || 0;
    return cartSubtotal >= min;
  }
  return true;
}

export function getFreeItemDisplayName(promo: Pick<PosPromotion, 'min_cart_subtotal'>, itemName: string): string {
  const threshold = Number(promo.min_cart_subtotal ?? 0) || 0;
  if (threshold > 0) {
    return `FREE ${itemName} on orders over $${Number.isInteger(threshold) ? threshold.toFixed(0) : threshold.toFixed(2)}`;
  }
  return `FREE ${itemName}`;
}

export function pickUnlockedFreeItemPromotion(promotions: PosPromotion[], cartSubtotal: number): PosPromotion | null {
  let best: PosPromotion | null = null;
  for (const promotion of promotions) {
    if (!isFreeItemPromotion(promotion)) continue;
    if (!appliesToCart(promotion, cartSubtotal)) continue;
    if (
      !best
      || (promotion.priority ?? 0) > (best.priority ?? 0)
      || (
        (promotion.priority ?? 0) === (best.priority ?? 0)
        && (Number(promotion.min_cart_subtotal ?? 0) || 0) > (Number(best.min_cart_subtotal ?? 0) || 0)
      )
    ) {
      best = promotion;
    }
  }
  return best;
}

export function findSelectedFreeItemPromotion(params: {
  promotions: PosPromotion[];
  items: PosPromotionCartItem[];
  cartSubtotal: number;
  selectedItemId?: string | null;
}): PosFreeItemPromotionMatch | null {
  const { promotions, items, cartSubtotal, selectedItemId } = params;
  if (!selectedItemId) return null;
  const selectedItem = items.find((item) => item.id === selectedItemId);
  if (!selectedItem) return null;

  let best: PosFreeItemPromotionMatch | null = null;
  for (const promotion of promotions) {
    if (!isFreeItemPromotion(promotion)) continue;
    if (!appliesToCart(promotion, cartSubtotal)) continue;
    if (!(promotion.product_ids || []).includes(selectedItem.product_id)) continue;

    const quantity = Math.max(1, Number(selectedItem.quantity) || 1);
    const unitPrice = clampCurrency((Number(selectedItem.subtotal) || 0) / quantity);
    if (unitPrice <= 0) continue;

    const configuredCap = Number(promotion.discount_value || 0);
    const discountAmount = clampCurrency(configuredCap > 0 ? Math.min(unitPrice, configuredCap) : unitPrice);
    if (discountAmount <= 0) continue;

    if (
      !best
      || discountAmount > best.discountAmount + 0.0001
      || (
        Math.abs(discountAmount - best.discountAmount) < 0.0001
        && (promotion.priority ?? 0) > (best.promotion.priority ?? 0)
      )
    ) {
      best = { promotion, item: selectedItem, unitPrice, discountAmount };
    }
  }
  return best;
}

export function computePosFreeItemPromotion(params: {
  promotions: PosPromotion[];
  items: PosPromotionCartItem[];
  cartSubtotal: number;
  selectedFreeItemId?: string | null;
}): {
  freeItemPromotion: PosFreeItemPromotionMatch | null;
  unlockedFreeItemPromotion: PosPromotion | null;
  freeItemSelectionRequired: boolean;
  discountAmount: number;
  appliedPromotion: PosAppliedPromotion | null;
} {
  const { promotions, items, cartSubtotal, selectedFreeItemId } = params;
  const selectedFreeItem = selectedFreeItemId ? items.find((item) => item.id === selectedFreeItemId) ?? null : null;
  const qualifyingCartSubtotal = clampCurrency(Math.max(0, cartSubtotal - (Number(selectedFreeItem?.subtotal) || 0)));
  const freeItemPromotion = findSelectedFreeItemPromotion({
    promotions,
    items,
    cartSubtotal: qualifyingCartSubtotal,
    selectedItemId: selectedFreeItemId,
  });
  const unlockedFreeItemPromotion = pickUnlockedFreeItemPromotion(promotions, qualifyingCartSubtotal);
  const discountAmount = freeItemPromotion?.discountAmount ?? 0;
  return {
    freeItemPromotion,
    unlockedFreeItemPromotion,
    freeItemSelectionRequired: !!unlockedFreeItemPromotion && !freeItemPromotion,
    discountAmount,
    appliedPromotion: freeItemPromotion ? {
      id: freeItemPromotion.promotion.id,
      title: freeItemPromotion.promotion.title,
      applies_to: 'cart',
      amount: freeItemPromotion.discountAmount,
      kind: 'free_item',
      selected_item_id: freeItemPromotion.item.id,
      selected_item_name: getFreeItemDisplayName(freeItemPromotion.promotion, freeItemPromotion.item.product_name),
      threshold: freeItemPromotion.promotion.min_cart_subtotal ?? null,
    } : null,
  };
}
