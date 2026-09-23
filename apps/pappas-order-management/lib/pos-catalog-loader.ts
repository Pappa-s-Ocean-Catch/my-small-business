import { supabase } from './supabase';
import { getSelectedPosLayoutId, normalizePosLayout, type PosLayoutRecord } from './pos-layouts';
import type { ProductAddonLink, ProductIngredient, PosCatalogSource } from './pos-catalog-snapshot';
import type { SaleCategory, SaleProduct } from '../app/pos.types';
import type { PosPromotion } from './pos-promotions';

const PAGE_SIZE = 500;

// PostgREST defaults to a limited result set. Page every source so the snapshot
// never silently omits products or customization rows in a larger catalogue.
async function allRows<T>(makeQuery: () => any): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function loadPosCatalogSource(): Promise<PosCatalogSource> {
  const [categories, products, addonLinks, ingredients, promotions, layouts, selectedLayoutId] = await Promise.all([
    allRows<SaleCategory>(() => supabase.from('sale_categories')
      .select('id, name, section, sort_order, is_active, parent_category_id').eq('is_active', true).order('sort_order')),
    allRows<SaleProduct>(() => supabase.from('sale_products')
      .select('id, name, description, section, search_term, sale_price, image_url, sale_category_id, sub_category_id, sort_order, is_active')
      .eq('is_active', true).order('name')),
    allRows<ProductAddonLink>(() => supabase.from('sale_product_addon_groups').select(`
      sale_product_id, display_order,
      addon_groups(id, name, is_required, multiple_choice,
        addon_items(id, addon_group_id, name, extra_price, section, sort_order, is_active))
    `).order('display_order')),
    allRows<ProductIngredient>(() => supabase.from('sale_product_ingredients')
      .select('id, sale_product_id, customer_can_remove, products!product_id(name)')
      .eq('customer_can_remove', true).order('id')),
    allRows<PosPromotion>(() => supabase.from('promotions')
      .select('*, promotion_products(sale_product_id)').eq('is_active', true).order('priority', { ascending: false })),
    allRows<PosLayoutRecord>(() => supabase.from('pos_layouts')
      .select('id, name, layout, is_default, created_at, updated_at')
      .order('is_default', { ascending: false }).order('updated_at', { ascending: false })),
    getSelectedPosLayoutId().catch(() => null),
  ]);

  return {
    categories,
    products,
    addonLinks,
    ingredients,
    promotions: promotions.map((row: any) => ({
      ...row,
      discount_value: Number(row.discount_value ?? 0),
      min_product_price: row.min_product_price == null ? null : Number(row.min_product_price),
      min_cart_subtotal: row.min_cart_subtotal == null ? null : Number(row.min_cart_subtotal),
      priority: Number(row.priority ?? 0),
      product_ids: (row.promotion_products || []).map((entry: any) => String(entry.sale_product_id)),
    })),
    layouts: layouts.map((row) => ({ ...row, layout: normalizePosLayout(row.layout) })),
    selectedLayoutId,
  };
}
