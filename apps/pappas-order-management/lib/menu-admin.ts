import { supabase } from '@/lib/supabase';

export type MobileSaleCategory = {
  id: string;
  name: string;
  description: string | null;
  section: string | null;
  sort_order: number | null;
  parent_category_id: string | null;
  is_active: boolean | null;
};

export type MobileSaleProduct = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  section: string | null;
  search_term: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_text: string | null;
  sale_price: number;
  image_url: string | null;
  sale_category_id: string | null;
  sub_category_id: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  is_featured: boolean | null;
  preparation_time_minutes: number | null;
  warning_threshold_units: number | null;
  alert_threshold_units: number | null;
};

export type MobileSaleProductIngredient = {
  id?: string;
  sale_product_id?: string;
  product_id: string;
  quantity_required: number;
  unit_of_measure: string;
  is_optional: boolean;
  customer_can_remove: boolean;
  notes: string | null;
  product_name?: string | null;
};

export type MobileSaleProductInclude = {
  parent_sale_product_id?: string;
  included_sale_product_id: string;
  quantity: number;
  included_product_name?: string | null;
};

export type MobileSaleProductDetails = MobileSaleProduct & {
  ingredients: MobileSaleProductIngredient[];
  included_products: MobileSaleProductInclude[];
};

export type MobileAvailableProduct = {
  id: string;
  name: string;
  sku: string | null;
  purchase_price: number | null;
  total_units: number | null;
  units_per_box: number | null;
};

export type MobileAddonItem = {
  id: string;
  addon_group_id: string;
  name: string;
  extra_price: number;
  section: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

export type MobileAddonGroup = {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean | null;
  multiple_choice: boolean | null;
  sort_order: number | null;
  is_active: boolean | null;
  items: MobileAddonItem[];
};

const cleanText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export async function fetchMobileSaleCategories() {
  const { data, error } = await supabase
    .from('sale_categories')
    .select('id, name, description, section, sort_order, parent_category_id, is_active')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as MobileSaleCategory[];
}

export async function fetchMobileSaleProducts() {
  const { data, error } = await supabase
    .from('sale_products')
    .select('id, slug, name, description, section, search_term, seo_title, seo_description, seo_text, sale_price, image_url, sale_category_id, sub_category_id, sort_order, is_active, is_featured, preparation_time_minutes, warning_threshold_units, alert_threshold_units')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as MobileSaleProduct[];
}

export async function fetchMobileSaleProductDetails(id: string) {
  const { data: product, error: productError } = await supabase
    .from('sale_products')
    .select('id, slug, name, description, section, search_term, seo_title, seo_description, seo_text, sale_price, image_url, sale_category_id, sub_category_id, sort_order, is_active, is_featured, preparation_time_minutes, warning_threshold_units, alert_threshold_units')
    .eq('id', id)
    .single();

  if (productError) throw new Error(productError.message);

  const [ingredientResult, includeResult] = await Promise.all([
    supabase
      .from('sale_product_ingredients')
      .select('id, sale_product_id, product_id, quantity_required, unit_of_measure, is_optional, customer_can_remove, notes, products!product_id(name)')
      .eq('sale_product_id', id),
    supabase
      .from('sale_product_includes')
      .select('parent_sale_product_id, included_sale_product_id, quantity, included:sale_products!included_sale_product_id(name)')
      .eq('parent_sale_product_id', id),
  ]);

  if (ingredientResult.error) throw new Error(ingredientResult.error.message);
  if (includeResult.error) throw new Error(includeResult.error.message);

  const ingredients = (ingredientResult.data || []).map((row: any) => {
    const joined = Array.isArray(row.products) ? row.products[0] : row.products;
    return {
      id: row.id,
      sale_product_id: row.sale_product_id,
      product_id: row.product_id,
      quantity_required: Number(row.quantity_required || 0),
      unit_of_measure: row.unit_of_measure || 'units',
      is_optional: Boolean(row.is_optional),
      customer_can_remove: Boolean(row.customer_can_remove),
      notes: row.notes || null,
      product_name: joined?.name || null,
    } satisfies MobileSaleProductIngredient;
  });

  const included_products = (includeResult.data || []).map((row: any) => {
    const joined = Array.isArray(row.included) ? row.included[0] : row.included;
    return {
      parent_sale_product_id: row.parent_sale_product_id,
      included_sale_product_id: row.included_sale_product_id,
      quantity: Number(row.quantity || 1),
      included_product_name: joined?.name || null,
    } satisfies MobileSaleProductInclude;
  });

  return {
    ...(product as MobileSaleProduct),
    ingredients,
    included_products,
  } satisfies MobileSaleProductDetails;
}

export async function fetchMobileAvailableProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, purchase_price, total_units, units_per_box')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as MobileAvailableProduct[];
}

export async function createMobileSaleCategory(input: {
  name: string;
  description?: string;
  section?: string;
  sort_order?: number;
  parent_category_id?: string | null;
  is_active?: boolean;
}) {
  const { error } = await supabase
    .from('sale_categories')
    .insert({
      name: input.name.trim(),
      description: cleanText(input.description),
      section: cleanText(input.section),
      sort_order: input.sort_order ?? 0,
      parent_category_id: input.parent_category_id || null,
      is_active: input.is_active ?? true,
    });

  if (error) throw new Error(error.message);
}

export async function updateMobileSaleCategory(
  id: string,
  input: {
    name: string;
    description?: string;
    section?: string;
    sort_order?: number;
    parent_category_id?: string | null;
    is_active?: boolean;
  }
) {
  const { error } = await supabase
    .from('sale_categories')
    .update({
      name: input.name.trim(),
      description: cleanText(input.description),
      section: cleanText(input.section),
      sort_order: input.sort_order ?? 0,
      parent_category_id: input.parent_category_id || null,
      is_active: input.is_active ?? true,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteMobileSaleCategory(id: string) {
  const { error } = await supabase
    .from('sale_categories')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function fetchMobileAddonGroups() {
  const { data: groups, error: groupsError } = await supabase
    .from('addon_groups')
    .select('id, name, description, is_required, multiple_choice, sort_order, is_active')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (groupsError) throw new Error(groupsError.message);

  const ids = (groups || []).map((group) => group.id);
  const { data: items, error: itemsError } = await supabase
    .from('addon_items')
    .select('id, addon_group_id, name, extra_price, section, sort_order, is_active')
    .in('addon_group_id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'])
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (itemsError) throw new Error(itemsError.message);

  return ((groups || []) as Omit<MobileAddonGroup, 'items'>[]).map((group) => ({
    ...group,
    items: ((items || []) as MobileAddonItem[]).filter((item) => item.addon_group_id === group.id),
  }));
}

export async function createMobileAddonGroup(input: {
  name: string;
  description?: string;
  is_required?: boolean;
  multiple_choice?: boolean;
  sort_order?: number;
  is_active?: boolean;
}) {
  const { error } = await supabase
    .from('addon_groups')
    .insert({
      name: input.name.trim(),
      description: cleanText(input.description),
      is_required: input.is_required ?? false,
      multiple_choice: input.multiple_choice ?? true,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
    });

  if (error) throw new Error(error.message);
}

export async function updateMobileAddonGroup(
  id: string,
  input: {
    name: string;
    description?: string;
    is_required?: boolean;
    multiple_choice?: boolean;
    sort_order?: number;
    is_active?: boolean;
  }
) {
  const { error } = await supabase
    .from('addon_groups')
    .update({
      name: input.name.trim(),
      description: cleanText(input.description),
      is_required: input.is_required ?? false,
      multiple_choice: input.multiple_choice ?? true,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteMobileAddonGroup(id: string) {
  const { error } = await supabase
    .from('addon_groups')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function createMobileAddonItem(input: {
  addon_group_id: string;
  name: string;
  extra_price: number;
  section?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  const { error } = await supabase
    .from('addon_items')
    .insert({
      addon_group_id: input.addon_group_id,
      name: input.name.trim(),
      extra_price: input.extra_price,
      section: cleanText(input.section),
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
    });

  if (error) throw new Error(error.message);
}

export async function updateMobileAddonItem(
  id: string,
  input: {
    name: string;
    extra_price: number;
    section?: string;
    sort_order?: number;
    is_active?: boolean;
  }
) {
  const { error } = await supabase
    .from('addon_items')
    .update({
      name: input.name.trim(),
      extra_price: input.extra_price,
      section: cleanText(input.section),
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteMobileAddonItem(id: string) {
  const { error } = await supabase
    .from('addon_items')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function fetchSaleProductAddonGroupIds(productId: string) {
  const { data, error } = await supabase
    .from('sale_product_addon_groups')
    .select('addon_group_id')
    .eq('sale_product_id', productId)
    .order('display_order', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map((row) => row.addon_group_id as string);
}

async function replaceSaleProductAddonGroups(productId: string, addonGroupIds: string[]) {
  const { error: deleteError } = await supabase
    .from('sale_product_addon_groups')
    .delete()
    .eq('sale_product_id', productId);

  if (deleteError) throw new Error(deleteError.message);

  if (addonGroupIds.length === 0) return;

  const { error: insertError } = await supabase
    .from('sale_product_addon_groups')
    .insert(addonGroupIds.map((addon_group_id, index) => ({
      sale_product_id: productId,
      addon_group_id,
      display_order: index,
    })));

  if (insertError) throw new Error(insertError.message);
}

async function replaceSaleProductIngredients(
  productId: string,
  ingredients: Array<{
    product_id: string;
    quantity_required: number;
    unit_of_measure: string;
    is_optional: boolean;
    customer_can_remove: boolean;
    notes?: string | null;
  }>
) {
  const { error: deleteError } = await supabase
    .from('sale_product_ingredients')
    .delete()
    .eq('sale_product_id', productId);

  if (deleteError) throw new Error(deleteError.message);

  const rows = ingredients
    .filter((ingredient) => ingredient.product_id)
    .map((ingredient) => ({
      sale_product_id: productId,
      product_id: ingredient.product_id,
      quantity_required: ingredient.quantity_required,
      unit_of_measure: ingredient.unit_of_measure,
      is_optional: ingredient.is_optional,
      customer_can_remove: ingredient.customer_can_remove,
      notes: cleanText(ingredient.notes),
    }));

  if (rows.length === 0) return;

  const { error: insertError } = await supabase
    .from('sale_product_ingredients')
    .insert(rows);

  if (insertError) throw new Error(insertError.message);
}

async function replaceSaleProductIncludes(
  productId: string,
  includes: Array<{
    included_sale_product_id: string;
    quantity: number;
  }>
) {
  const { error: deleteError } = await supabase
    .from('sale_product_includes')
    .delete()
    .eq('parent_sale_product_id', productId);

  if (deleteError) throw new Error(deleteError.message);

  const rows = includes
    .filter((row) => row.included_sale_product_id)
    .map((row) => ({
      parent_sale_product_id: productId,
      included_sale_product_id: row.included_sale_product_id,
      quantity: Math.max(1, Number(row.quantity || 1)),
    }));

  if (rows.length === 0) return;

  const { error: insertError } = await supabase
    .from('sale_product_includes')
    .insert(rows);

  if (insertError) throw new Error(insertError.message);
}

export async function createMobileSaleProduct(input: {
  name: string;
  description?: string;
  section?: string;
  search_term?: string;
  slug?: string;
  seo_title?: string;
  seo_description?: string;
  seo_text?: string;
  sale_price: number;
  image_url?: string;
  sale_category_id?: string | null;
  sub_category_id?: string | null;
  sort_order?: number;
  is_active?: boolean;
  is_featured?: boolean;
  preparation_time_minutes?: number;
  warning_threshold_units?: number | null;
  alert_threshold_units?: number | null;
  ingredients?: MobileSaleProductIngredient[];
  included_products?: MobileSaleProductInclude[];
  addon_group_ids?: string[];
}) {
  const { data, error } = await supabase
    .from('sale_products')
    .insert({
      name: input.name.trim(),
      description: cleanText(input.description),
      section: cleanText(input.section),
      search_term: cleanText(input.search_term),
      slug: cleanText(input.slug),
      seo_title: cleanText(input.seo_title),
      seo_description: cleanText(input.seo_description),
      seo_text: cleanText(input.seo_text),
      sale_price: input.sale_price,
      image_url: cleanText(input.image_url),
      sale_category_id: input.sale_category_id || null,
      sub_category_id: input.sub_category_id || null,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
      is_featured: input.is_featured ?? false,
      preparation_time_minutes: input.preparation_time_minutes ?? 0,
      warning_threshold_units: input.warning_threshold_units ?? null,
      alert_threshold_units: input.alert_threshold_units ?? null,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  await replaceSaleProductAddonGroups(data.id as string, input.addon_group_ids || []);
  await replaceSaleProductIngredients(data.id as string, input.ingredients || []);
  await replaceSaleProductIncludes(data.id as string, input.included_products || []);
}

export async function updateMobileSaleProduct(
  id: string,
  input: {
    name: string;
    description?: string;
    section?: string;
    search_term?: string;
    slug?: string;
    seo_title?: string;
    seo_description?: string;
    seo_text?: string;
    sale_price: number;
    image_url?: string;
    sale_category_id?: string | null;
    sub_category_id?: string | null;
    sort_order?: number;
    is_active?: boolean;
    is_featured?: boolean;
    preparation_time_minutes?: number;
    warning_threshold_units?: number | null;
    alert_threshold_units?: number | null;
    ingredients?: MobileSaleProductIngredient[];
    included_products?: MobileSaleProductInclude[];
    addon_group_ids?: string[];
  }
) {
  const { error } = await supabase
    .from('sale_products')
    .update({
      name: input.name.trim(),
      description: cleanText(input.description),
      section: cleanText(input.section),
      search_term: cleanText(input.search_term),
      slug: cleanText(input.slug),
      seo_title: cleanText(input.seo_title),
      seo_description: cleanText(input.seo_description),
      seo_text: cleanText(input.seo_text),
      sale_price: input.sale_price,
      image_url: cleanText(input.image_url),
      sale_category_id: input.sale_category_id || null,
      sub_category_id: input.sub_category_id || null,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
      is_featured: input.is_featured ?? false,
      preparation_time_minutes: input.preparation_time_minutes ?? 0,
      warning_threshold_units: input.warning_threshold_units ?? null,
      alert_threshold_units: input.alert_threshold_units ?? null,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
  await replaceSaleProductAddonGroups(id, input.addon_group_ids || []);
  await replaceSaleProductIngredients(id, input.ingredients || []);
  await replaceSaleProductIncludes(id, input.included_products || []);
}

export async function deleteMobileSaleProduct(id: string) {
  const { error } = await supabase
    .from('sale_products')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}
