import type { Order } from '@my-small-business/types';

type PromotionEntry = {
  label: string;
  detail?: string | null;
};

function getFreePromotionItemNames(order: Pick<Order, 'promotions_applied'>): string[] {
  const promotions = Array.isArray(order.promotions_applied) ? order.promotions_applied : [];

  return promotions
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      if (record.kind !== 'free_item') return null;
      if (typeof record.selected_item_name !== 'string') return null;
      const value = record.selected_item_name.trim();
      return value.length > 0 ? value : null;
    })
    .filter((value): value is string => value !== null);
}

export function getOrderPromotionSummary(order: Pick<Order, 'promotions_applied'>): PromotionEntry | null {
  const promotions = Array.isArray(order.promotions_applied) ? order.promotions_applied : [];
  const first = promotions.find((entry) => entry && typeof entry === 'object') as Record<string, unknown> | undefined;
  if (!first) return null;

  const selectedItemName = typeof first.selected_item_name === 'string' && first.selected_item_name.trim().length > 0
    ? first.selected_item_name.trim()
    : null;

  return {
    label: 'Discount',
    detail: typeof first.kind === 'string' && first.kind === 'free_item' && selectedItemName
      ? `Free item selected: ${selectedItemName}`
      : null,
  };
}

export function isFreePromotionOrderItem(
  order: Pick<Order, 'promotions_applied'>,
  productName: string | null | undefined
): boolean {
  const normalizedName = typeof productName === 'string' ? productName.trim() : '';
  if (!normalizedName) return false;

  return getFreePromotionItemNames(order).includes(normalizedName);
}
