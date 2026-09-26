export type CatalogCategory = {
  id: string;
  name: string;
  active?: boolean | null;
  is_active?: boolean | null;
  sortOrder?: number | null;
  sort_order?: number | null;
};

export type CatalogProduct = {
  id: string;
  name: string;
  active?: boolean | null;
  is_active?: boolean | null;
  categoryId?: string | null;
  sale_category_id?: string | null;
  subCategoryId?: string | null;
  sub_category_id?: string | null;
  sortOrder?: number | null;
  sort_order?: number | null;
};

export type CatalogSource<TCategory extends CatalogCategory = CatalogCategory, TProduct extends CatalogProduct = CatalogProduct> = {
  categories: TCategory[];
  products: TProduct[];
};

export type CatalogSnapshot<TCategory extends CatalogCategory = CatalogCategory, TProduct extends CatalogProduct = CatalogProduct> = {
  categories: TCategory[];
  products: TProduct[];
  productsById: Map<string, TProduct>;
  productsByCategoryId: Map<string, TProduct[]>;
};

function isActive(record: Pick<CatalogCategory, 'active' | 'is_active'>): boolean {
  return record.active !== false && record.is_active !== false;
}

function productCategoryIds(product: CatalogProduct): string[] {
  return [product.categoryId ?? product.sale_category_id, product.subCategoryId ?? product.sub_category_id]
    .filter((id): id is string => Boolean(id));
}

function sortOrder(record: Pick<CatalogCategory, 'sortOrder' | 'sort_order'>): number {
  return record.sortOrder ?? record.sort_order ?? 0;
}

export function buildCatalogSnapshot<TCategory extends CatalogCategory, TProduct extends CatalogProduct>(
  source: CatalogSource<TCategory, TProduct>,
): CatalogSnapshot<TCategory, TProduct> {
  const products = source.products.filter(isActive);
  const productsByCategoryId = new Map<string, TProduct[]>();

  for (const product of products) {
    for (const categoryId of new Set(productCategoryIds(product))) {
      const indexed = productsByCategoryId.get(categoryId) ?? [];
      indexed.push(product);
      productsByCategoryId.set(categoryId, indexed);
    }
  }

  for (const indexed of productsByCategoryId.values()) {
    indexed.sort((left, right) => sortOrder(left) - sortOrder(right) || left.name.localeCompare(right.name));
  }

  return {
    categories: source.categories.filter(isActive),
    products,
    productsById: new Map(products.map((product) => [product.id, product])),
    productsByCategoryId,
  };
}

export function productsForCategories<TProduct>(
  snapshot: Pick<CatalogSnapshot<CatalogCategory, TProduct & CatalogProduct>, 'productsByCategoryId'>,
  categoryIds: string[],
): TProduct[] {
  const seen = new Set<string>();
  return categoryIds.flatMap((categoryId) => snapshot.productsByCategoryId.get(categoryId) ?? [])
    .filter((product) => {
      if (seen.has(product.id)) return false;
      seen.add(product.id);
      return true;
    })
    .sort((left, right) => sortOrder(left) - sortOrder(right) || left.name.localeCompare(right.name));
}
