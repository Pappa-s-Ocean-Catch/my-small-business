import type { SupabaseClient } from '@supabase/supabase-js';
import type { DesktopCatalogCategory, DesktopCatalogProduct, DesktopCatalogSnapshot, CustomizationData, RemovableIngredient } from '../pos/pos-types';
import { buildCatalogSnapshot } from '@my-small-business/pos-domain';

const PAGE_SIZE = 500;

async function allRows<T>(client: any, queryStr: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client.from(queryStr.split('?')[0]).select(queryStr.split('?')[1]).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function priceInCents(value: unknown): number {
  const dollars = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
}

export async function loadDesktopCatalog(client: SupabaseClient): Promise<DesktopCatalogSnapshot> {
  const [categories, products, addonLinks, ingredients] = await Promise.all([
    allRows<any>(client, 'sale_categories?id, name, sort_order, is_active, parent_category_id').then(rows => rows.filter(r => r.is_active !== false).sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))),
    allRows<any>(client, 'sale_products?id, name, description, sale_price, image_url, sale_category_id, sub_category_id, sort_order, is_active').then(rows => rows.filter(r => r.is_active !== false).sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))),
    allRows<any>(client, 'sale_product_addon_groups?sale_product_id, display_order, addon_groups(id, name, is_required, multiple_choice, addon_items(id, addon_group_id, name, extra_price, sort_order, is_active))'),
    allRows<any>(client, 'sale_product_ingredients?id, sale_product_id, customer_can_remove, products!product_id(name)'),
  ]);

  const source = {
    categories: categories as DesktopCatalogCategory[],
    products: products.map((product) => ({ ...product, salePriceCents: priceInCents(product.sale_price) })) as DesktopCatalogProduct[],
  };

  const baseSnapshot = buildCatalogSnapshot(source);
  const customizations = new Map<string, CustomizationData>();

  for (const product of baseSnapshot.products) {
    customizations.set(product.id, { groups: [], removableIngredients: [] });
  }

  for (const link of addonLinks) {
    const value = customizations.get(link.sale_product_id);
    const group = (Array.isArray(link.addon_groups) ? link.addon_groups[0] : link.addon_groups) as any;
    if (!value || !group) continue;
    value.groups.push({
      id: group.id,
      name: group.name,
      is_required: Boolean(group.is_required),
      multiple_choice: Boolean(group.multiple_choice),
      display_order: link.display_order,
      items: (group.addon_items || []).filter((item: any) => item.is_active !== false)
        .map((item: any) => ({ ...item, extra_price: Number(item.extra_price ?? 0) }))
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)),
    });
  }

  for (const value of customizations.values()) {
    value.groups.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }

  for (const ingredient of ingredients) {
    const value = customizations.get(ingredient.sale_product_id);
    if (!value || !ingredient.customer_can_remove) continue;
    const joined = Array.isArray(ingredient.products) ? ingredient.products[0] : ingredient.products;
    const removable: RemovableIngredient = {
      id: ingredient.id,
      ingredient_name: joined?.name?.trim() || 'Unknown ingredient',
      customer_can_remove: true,
    };
    value.removableIngredients.push(removable);
  }

  return {
    ...baseSnapshot,
    customizations,
  };
}
