import type { AddonGroup, AddonItem, CustomizationData, RemovableIngredient, SaleCategory, SaleProduct } from '../app/pos.types';
import type { PosLayoutRecord } from './pos-layouts';
import type { PosPromotion } from './pos-promotions';
import { DEFAULT_KITCHEN_SECTION, isCombineProduct, parseKitchenSections } from '../utils/orderUtils';

export type ProductAddonLink = {
  sale_product_id: string;
  display_order: number | null;
  addon_groups: (Omit<AddonGroup, 'display_order' | 'items'> & { addon_items: AddonItem[] }) | null;
};
export type ProductIngredient = {
  id: string;
  sale_product_id: string;
  customer_can_remove: boolean;
  products: { name?: string } | { name?: string }[] | null;
};
export type ProductIncludeLink = {
  parent_sale_product_id: string;
  included_sale_product_id: string;
  quantity?: number;
};
export type PosCatalogSource = {
  categories: SaleCategory[];
  products: SaleProduct[];
  addonLinks: ProductAddonLink[];
  ingredients: ProductIngredient[];
  productIncludes?: ProductIncludeLink[];
  promotions: PosPromotion[];
  layouts: PosLayoutRecord[];
  selectedLayoutId: string | null;
};
export type PosCatalogSnapshot = {
  categories: SaleCategory[];
  products: SaleProduct[];
  productsById: Map<string, SaleProduct>;
  productsByCategoryId: Map<string, SaleProduct[]>;
  productIncludesByParentId: Map<string, ProductIncludeLink[]>;
  customizations: Map<string, CustomizationData>;
  customizableIds: Set<string>;
  promotions: PosPromotion[];
  layouts: PosLayoutRecord[];
  preferredLayout: PosLayoutRecord | null;
};

export function getProductCombineSections(
  snapshot: Pick<PosCatalogSnapshot, 'productIncludesByParentId' | 'productsById' | 'categories'>,
  product: Pick<SaleProduct, 'id' | 'name' | 'sale_category_id' | 'sub_category_id'>
): string[] {
  const includes = snapshot.productIncludesByParentId.get(product.id) || [];
  if (includes.length > 0) {
    const categoriesById = new Map(snapshot.categories.map((cat) => [cat.id, cat.section]));
    const sections = new Set<string>();
    for (const link of includes) {
      const included = snapshot.productsById.get(link.included_sale_product_id);
      if (included) {
        const itemSection = included.section
          || (included.sub_category_id ? categoriesById.get(included.sub_category_id) : null)
          || (included.sale_category_id ? categoriesById.get(included.sale_category_id) : null)
          || DEFAULT_KITCHEN_SECTION;
        parseKitchenSections(itemSection).forEach((s) => sections.add(s));
      } else {
        sections.add(DEFAULT_KITCHEN_SECTION);
      }
    }
    return Array.from(sections);
  }

  const category = snapshot.categories.find((cat) => cat.id === product.sale_category_id || cat.id === product.sub_category_id);
  if (isCombineProduct(product.name, category?.name, includes.length)) {
    return [DEFAULT_KITCHEN_SECTION];
  }

  return [];
}

export function productsForCategories(snapshot: PosCatalogSnapshot, categoryIds: string[]): SaleProduct[] {

  const seen = new Set<string>();
  return categoryIds.flatMap((id) => snapshot.productsByCategoryId.get(id) || [])
    .filter((product) => {
      if (seen.has(product.id)) return false;
      seen.add(product.id);
      return true;
    }).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export function buildPosCatalogSnapshot(source: PosCatalogSource): PosCatalogSnapshot {
  const products = source.products.filter((product) => product.is_active !== false);
  const productsByCategoryId = new Map<string, SaleProduct[]>();
  for (const product of products) {
    for (const id of new Set([product.sale_category_id, product.sub_category_id].filter((id): id is string => Boolean(id)))) {
      const categoryProducts = productsByCategoryId.get(id) || [];
      categoryProducts.push(product);
      productsByCategoryId.set(id, categoryProducts);
    }
  }
  const customizations = new Map<string, CustomizationData>();
  for (const product of products) customizations.set(product.id, { groups: [], removableIngredients: [] });

  for (const link of source.addonLinks) {
    const value = customizations.get(link.sale_product_id);
    const group = (Array.isArray(link.addon_groups) ? link.addon_groups[0] : link.addon_groups) as
      NonNullable<ProductAddonLink['addon_groups']> | undefined;
    if (!value || !group) continue;
    value.groups.push({
      id: group.id,
      name: group.name,
      is_required: Boolean(group.is_required),
      multiple_choice: Boolean(group.multiple_choice),
      display_order: link.display_order,
      items: (group.addon_items || []).filter((item) => item.is_active !== false)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)),
    });
  }
  for (const value of customizations.values()) value.groups.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  for (const ingredient of source.ingredients) {
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

  const productIncludesByParentId = new Map<string, ProductIncludeLink[]>();
  for (const include of source.productIncludes || []) {
    const list = productIncludesByParentId.get(include.parent_sale_product_id) || [];
    list.push(include);
    productIncludesByParentId.set(include.parent_sale_product_id, list);
  }

  const layouts = source.layouts;
  const preferredLayout = layouts.find((layout) => layout.id === source.selectedLayoutId)
    ?? layouts.find((layout) => layout.is_default)
    ?? layouts[0]
    ?? null;
  return {
    categories: source.categories.filter((category) => category.is_active !== false),
    products,
    productsById: new Map(products.map((product) => [product.id, product])),
    productsByCategoryId,
    productIncludesByParentId,
    customizations,
    customizableIds: new Set([...customizations].filter(([, value]) =>
      value.groups.length > 0 || value.removableIngredients.length > 0).map(([id]) => id)),
    promotions: source.promotions,
    layouts,
    preferredLayout,
  };
}
