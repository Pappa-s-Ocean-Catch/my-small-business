import type { SaleCategory, SaleProduct } from '../../app/pos.types';
import type { PosLayoutData } from '../../lib/pos-layout-config';

/** Return modifiers to the same visible group, including virtual groups and search origins. */
export function productGroupId(product: SaleProduct, categories: SaleCategory[], layout: PosLayoutData | null, preferredId?: string | null): string | null {
  const hiddenSourceIds = new Set(layout?.categories.filter(c => c.hideSourceCategories).flatMap(c => c.sourceCategoryIds?.length ? c.sourceCategoryIds : [c.categoryId]));
  const visible = (id: string) => !hiddenSourceIds.has(id) && layout?.categories.find(c => c.categoryId === id)?.visible !== false;
  const belongs = (id: string) => {
    const group = layout?.categories.find(c => c.categoryId === id);
    const sources = group?.sourceCategoryIds?.length ? group.sourceCategoryIds : [id];
    return group?.products.some(p => p.productId === product.id) || sources.includes(product.sale_category_id || '') || sources.includes(product.sub_category_id || '') || categories.some(c => sources.includes(c.parent_category_id || '') && (c.id === product.sale_category_id || c.id === product.sub_category_id));
  };
  if (preferredId && visible(preferredId) && belongs(preferredId)) return preferredId;
  const configured = layout?.categories.find(c => visible(c.categoryId) && belongs(c.categoryId));
  if (configured) return configured.categoryId;
  const category = categories.find(c => c.id === (product.sub_category_id || product.sale_category_id));
  return category?.parent_category_id || category?.id || product.sale_category_id || null;
}
