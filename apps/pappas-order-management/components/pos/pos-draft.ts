import type { PosCartItem } from '../../app/pos.types';

const hasCustomizations = (item: PosCartItem) => Boolean(item.addons?.length || item.removed_ingredients?.length || item.comment);

/** Preserve the original POS plain-item merge rule, including promotion isolation. */
export function planProductTap(cart: PosCartItem[], added: PosCartItem, freeItemId: string | null) {
  const customizedCopy = cart.some((item) => item.product_id === added.product_id && hasCustomizations(item));
  const plain = cart.find((item) => item.product_id === added.product_id && item.id !== freeItemId && !hasCustomizations(item));
  if (plain && !customizedCopy) return {
    inserted: false,
    lineId: plain.id,
    items: updateAddedLine(cart, plain.id, { quantity: plain.quantity + added.quantity }, added.pos_updated_at || Date.now()),
  };
  return { inserted: true, lineId: added.id, items: [...cart, added] };
}

/** Immediate modifiers never insert a missing line or merge differently configured lines. */
export function updateAddedLine(cart: PosCartItem[], id: string, changes: Partial<Pick<PosCartItem, 'quantity' | 'addons' | 'comment' | 'removed_ingredients' | 'section'>>, updatedAt: number): PosCartItem[] {
  return cart.map((item) => {
    if (item.id !== id) return item;
    const next = { ...item, ...changes };
    return { ...next, override_price: null, subtotal: (next.base_price + (next.addons || []).reduce((sum, addon) => sum + Number(addon.addon_item_price || 0), 0)) * next.quantity, pos_updated_at: updatedAt };
  });
}

/** Keep historical choices that today's menu no longer exposes. */
export function mergeEditableAddons(existing: PosCartItem['addons'], replacement: PosCartItem['addons'], editableIds: string[]) {
  const ids = new Set(editableIds);
  return [...existing.filter(addon => !ids.has(addon.addon_item_id)), ...replacement.filter(addon => ids.has(addon.addon_item_id))];
}
export function mergeEditableRemovals(existing: string[], replacement: string[], editableNames: string[]) {
  const names = new Set(editableNames);
  return [...existing.filter(name => !names.has(name)), ...replacement];
}
