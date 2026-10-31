import type { SaleCategory, SaleProduct } from '../../app/pos.types';
import type { PosLayoutData } from '../../lib/pos-layout-config';

export type ProductMenuContext = { level: 'items' | 'subgroups'; categoryId: string | null; parentCategoryId: string | null };

export function categoryMenuContext(categoryId: string, categories: SaleCategory[], layout: PosLayoutData | null): ProductMenuContext {
  const group = layout?.categories.find(category => category.categoryId === categoryId);
  const sources = group?.sourceCategoryIds?.length ? group.sourceCategoryIds : [categoryId];
  const hasChildren = categories.some(category => sources.includes(category.parent_category_id || ''));
  return hasChildren && !group?.showProductsOnTopLevel
    ? { level: 'subgroups', categoryId: null, parentCategoryId: categoryId }
    : { level: 'items', categoryId, parentCategoryId: null };
}

/** Keep modifier returns in the product's child category, including search/cart origins. */
export function productMenuContext(product: SaleProduct, categories: SaleCategory[], layout: PosLayoutData | null, preferredId?: string | null): ProductMenuContext {
  const groupId = productGroupId(product, categories, layout, preferredId);
  if (!groupId) return { level: 'items', categoryId: null, parentCategoryId: null };
  const context = categoryMenuContext(groupId, categories, layout);
  if (context.level === 'subgroups') {
    const group = layout?.categories.find(category => category.categoryId === groupId);
    const sources = group?.sourceCategoryIds?.length ? group.sourceCategoryIds : [groupId];
    const child = categories.find(category => category.id === (product.sub_category_id || product.sale_category_id) && sources.includes(category.parent_category_id || ''));
    if (child) return { level: 'items', categoryId: child.id, parentCategoryId: groupId };
  }
  return { level: 'items', categoryId: groupId, parentCategoryId: null };
}

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


/** The same layout preference flattens the menu and makes product tiles add directly. Cart editing is independent. */
export function productTapSkipsCustomization(product: SaleProduct, categories: SaleCategory[], layout: PosLayoutData | null, preferredId?: string | null): boolean {
  const groupId = productGroupId(product, categories, layout, preferredId);
  return layout?.categories.find(category => category.categoryId === groupId)?.showProductsOnTopLevel === true;
}
