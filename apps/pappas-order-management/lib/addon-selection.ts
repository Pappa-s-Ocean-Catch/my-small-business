import type { OrderItemAddon } from '@my-small-business/types';
import type { AddonGroup, AddonItem } from '../app/pos.types';

export type AddonQuantities = Record<string, number>;

export function getAddonQuantity(quantities: AddonQuantities, addonItemId: string): number {
  return Math.max(0, Math.floor(quantities[addonItemId] || 0));
}

export function changeAddonQuantity(
  quantities: AddonQuantities,
  group: AddonGroup,
  item: AddonItem,
  delta: number,
): AddonQuantities {
  if (!group.multiple_choice) {
    if (delta <= 0 && getAddonQuantity(quantities, item.id) > 0) {
      const next = { ...quantities };
      delete next[item.id];
      return next;
    }

    const next = { ...quantities };
    for (const groupItem of group.items) delete next[groupItem.id];
    next[item.id] = 1;
    return next;
  }

  const nextQuantity = getAddonQuantity(quantities, item.id) + delta;
  const next = { ...quantities };
  if (nextQuantity <= 0) delete next[item.id];
  else next[item.id] = nextQuantity;
  return next;
}

export function buildAddonsFromQuantities(
  groups: AddonGroup[],
  quantities: AddonQuantities,
  now: () => string = () => new Date().toISOString(),
): OrderItemAddon[] {
  const addons: OrderItemAddon[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      const quantity = getAddonQuantity(quantities, item.id);
      for (let index = 0; index < quantity; index += 1) {
        addons.push({
          id: `pos-addon-${item.id}-${index + 1}`,
          order_item_id: '',
          addon_group_id: group.id,
          addon_group_name: group.name,
          addon_item_id: item.id,
          addon_item_name: item.name,
          addon_item_price: item.extra_price,
          section: item.section ?? null,
          created_at: now(),
          is_required: group.is_required,
          display_order: item.sort_order ?? undefined,
          display_group_order: group.display_order ?? undefined,
        });
      }
    }
  }
  return addons;
}

export function addonQuantitiesFromAddons(addons: OrderItemAddon[]): AddonQuantities {
  return addons.reduce<AddonQuantities>((quantities, addon) => ({
    ...quantities,
    [addon.addon_item_id]: getAddonQuantity(quantities, addon.addon_item_id) + 1,
  }), {});
}
