'use server';

import { createServiceRoleClient } from '@my-small-business/supabase/server';

// Product Media
export interface ProductMedia {
  id: string;
  sale_product_id: string;
  url: string;
  type: 'image' | 'video';
  sort_order: number;
  uploaded_by?: string | null;
  created_at: string;
  publish_status: boolean;
}

// Fetch all published media for a product
export async function getProductMedia(sale_product_id: string): Promise<{ data: ProductMedia[] | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from('sale_product_media')
      .select('*')
      .eq('sale_product_id', sale_product_id)
      .eq('publish_status', true)
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('Error fetching product media:', error);
      return { data: null, error: error.message };
    }
    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error fetching product media:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Add a media item to a product
export async function addProductMedia(media: {
  sale_product_id: string;
  url: string;
  type: 'image' | 'video';
  sort_order?: number;
  uploaded_by?: string;
  publish_status?: boolean;
}): Promise<{ data: ProductMedia | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    const { data, error } = await supabase
      .from('sale_product_media')
      .insert([
        {
          sale_product_id: media.sale_product_id,
          url: media.url,
          type: media.type,
          sort_order: media.sort_order ?? 0,
          uploaded_by: media.uploaded_by ?? null,
          publish_status: media.publish_status ?? true,
        },
      ])
      .select()
      .single();
    if (error) {
      console.error('Error adding product media:', error);
      return { data: null, error: error.message };
    }
    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error adding product media:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Delete a media item
export async function deleteProductMedia(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    const { error } = await supabase
      .from('sale_product_media')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting product media:', error);
      return { error: error.message };
    }
    return { error: null };
  } catch (error) {
    console.error('Unexpected error deleting product media:', error);
    return { error: 'An unexpected error occurred' };
  }
}

// Helper: fetch media for a list of product IDs
async function fetchMediaForProducts(productIds: string[]): Promise<Record<string, ProductMedia[]>> {
  if (!productIds.length) return {};
  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase
    .from('sale_product_media')
    .select('*')
    .in('sale_product_id', productIds);
  if (error || !data) return {};
  const map: Record<string, ProductMedia[]> = {};
  for (const m of data) {
    if (!map[m.sale_product_id]) map[m.sale_product_id] = [];
    map[m.sale_product_id].push(m as ProductMedia);
  }
  // Sort by sort_order
  for (const arr of Object.values(map)) arr.sort((a, b) => a.sort_order - b.sort_order);
  return map;
}

// Types
export interface SaleCategory {
  id: string;
  name: string;
  description: string | null;
  section: string | null;
  sort_order: number;
  is_active: boolean;
  parent_category_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data for hierarchy
  parent_category_name?: string | null;
  sub_categories?: SaleCategory[];
}

export interface SaleProduct {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  section: string | null;
  search_term: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_text: string | null;
  sort_order: number;
  sale_price: number;
  image_url: string | null;
  sale_category_id: string | null;
  sub_category_id: string | null;
  is_active: boolean;
  is_featured: boolean;
  preparation_time_minutes: number;
  created_at: string;
  updated_at: string;
  warning_threshold_units?: number | null;
  alert_threshold_units?: number | null;
}

export interface SaleProductIngredient {
  id: string;
  sale_product_id: string;
  product_id: string;
  quantity_required: number;
  unit_of_measure: string;
  is_optional: boolean;
  customer_can_remove: boolean;
  notes: string | null;
  created_at: string;
  // Joined data
  product_name?: string;
  product_sku?: string;
  product_purchase_price?: number;
  product_unit_price?: number;
  product_total_units?: number;
  product_units_per_box?: number;
}

export interface SaleProductIncludeItem {
  parent_sale_product_id: string;
  included_sale_product_id: string;
  quantity: number;
  included_product_name?: string;
  included_product_sale_price?: number;
  included_product_image_url?: string | null;
}

export interface SaleProductWithDetails extends SaleProduct {
  cost_of_goods: number;
  profit_margin: number;
  is_available: boolean;
  ingredients: SaleProductIngredient[];
  included_products: SaleProductIncludeItem[];
  category_name?: string;
  sub_category_name?: string;
}

// Sale Categories CRUD
export async function getSaleCategories(): Promise<{ data: SaleCategory[] | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    // Fetch all categories with hierarchy information
    const { data, error } = await supabase
      .from('sale_categories')
      .select(`
        *,
        parent_category:sale_categories!parent_category_id(name)
      `)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching sale categories:', error);
      return { data: null, error: error.message };
    }

    // Transform the data to include parent category name
    const transformedData = data?.map(category => ({
      ...category,
      parent_category_name: category.parent_category?.name || null
    })) || [];

    return { data: transformedData, error: null };
  } catch (error) {
    console.error('Unexpected error fetching sale categories:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function createSaleCategory(formData: {
  name: string;
  description?: string;
  section?: string;
  sort_order?: number;
  parent_category_id?: string;
  is_active?: boolean;
}): Promise<{ data: SaleCategory | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase
      .from('sale_categories')
      .insert([{
        name: formData.name,
        description: formData.description || null,
        section: formData.section?.trim() || null,
        sort_order: formData.sort_order || 0,
        parent_category_id: formData.parent_category_id || null,
        is_active: formData.is_active !== undefined ? formData.is_active : true
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating sale category:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error creating sale category:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function updateSaleCategory(
  id: string,
  formData: {
    name: string;
    description?: string;
    section?: string;
    sort_order?: number;
    is_active?: boolean;
    parent_category_id?: string;
  }
): Promise<{ data: SaleCategory | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase
      .from('sale_categories')
      .update({
        name: formData.name,
        description: formData.description || null,
        section: formData.section?.trim() || null,
        sort_order: formData.sort_order || 0,
        is_active: formData.is_active !== undefined ? formData.is_active : true,
        parent_category_id: formData.parent_category_id || null
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating sale category:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error updating sale category:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function deleteSaleCategory(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { error } = await supabase
      .from('sale_categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting sale category:', error);
      return { error: error.message };
    }

    return { error: null };
  } catch (error) {
    console.error('Unexpected error deleting sale category:', error);
    return { error: 'An unexpected error occurred' };
  }
}

export async function setSaleCategorySortOrders(
  updates: Array<{ id: string; sort_order: number }>
): Promise<{ error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from('sale_categories')
          .update({ sort_order: u.sort_order })
          .eq('id', u.id)
      )
    );

    const firstError = results.find((r) => r.error)?.error;
    if (firstError) {
      console.error('Error updating sale category sort orders:', firstError);
      return { error: firstError.message };
    }

    return { error: null };
  } catch (error) {
    console.error('Unexpected error updating sale category sort orders:', error);
    return { error: 'An unexpected error occurred' };
  }
}

// Sale Products CRUD
export async function getSaleProducts(): Promise<{ data: SaleProductWithDetails[] | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    // Get sale products with category and sub-category names
    const { data: products, error: productsError } = await supabase
      .from('sale_products')
      .select(`
        id,
        slug,
        name,
        description,
        search_term,
        seo_title,
        seo_description,
        seo_text,
        sort_order,
        sale_price,
        image_url,
        sale_category_id,
        sub_category_id,
        is_active,
        is_featured,
        preparation_time_minutes,
        created_at,
        updated_at,
        warning_threshold_units,
        alert_threshold_units,
        sale_categories!sale_category_id(name),
        sub_category:sale_categories!sub_category_id(name)
      `)
      .order('sale_category_id', { ascending: true })
      .order('sub_category_id', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (productsError) {
      console.error('Error fetching sale products:', productsError);
      return { data: null, error: productsError.message };
    }

    if (!products) {
      return { data: [], error: null };
    }

    // Get ingredients for each product
    const productIds = products.map(p => p.id);

    // Get media for each product
    const mediaMap = await fetchMediaForProducts(productIds);
    const { data: ingredients, error: ingredientsError } = await supabase
      .from('sale_product_ingredients')
      .select(`
        id,
        sale_product_id,
        product_id,
        quantity_required,
        unit_of_measure,
        is_optional,
        customer_can_remove,
        notes,
        created_at,
        products!product_id(name, sku, purchase_price, total_units)
      `)
      .in('sale_product_id', productIds);

    if (ingredientsError) {
      console.error('Error fetching ingredients:', ingredientsError);
      return { data: null, error: ingredientsError.message };
    }

    // Get bundle/pack includes for each product
    const { data: includes, error: includesError } = await supabase
      .from('sale_product_includes')
      .select(`
        parent_sale_product_id,
        included_sale_product_id,
        quantity,
        included:sale_products!included_sale_product_id(id, name, sale_price, image_url)
      `)
      .in('parent_sale_product_id', productIds);

    if (includesError) {
      console.error('Error fetching sale product includes:', includesError);
      return { data: null, error: includesError.message };
    }

    // Build lookup maps to avoid O(products * ingredients/includes) filtering
    const ingredientsByProductId = new Map<string, Array<any>>();
    for (const ing of ingredients || []) {
      const key = String((ing as any).sale_product_id);
      const list = ingredientsByProductId.get(key);
      if (list) list.push(ing);
      else ingredientsByProductId.set(key, [ing]);
    }

    const includesByParentId = new Map<string, Array<any>>();
    for (const inc of includes || []) {
      const key = String((inc as any).parent_sale_product_id);
      const list = includesByParentId.get(key);
      if (list) list.push(inc);
      else includesByParentId.set(key, [inc]);
    }

    // Combine data and calculate costs
    const productsWithDetails: (SaleProductWithDetails & { media?: ProductMedia[] })[] = products.map(product => {
      const productIngredients = ingredientsByProductId.get(String(product.id)) || [];
      const productIncludes = includesByParentId.get(String(product.id)) || [];

      const costOfGoods = productIngredients.reduce((total: number, ing: any) => {
        const joined = Array.isArray(ing.products) ? ing.products[0] : ing.products;
        const purchasePrice = typeof joined?.purchase_price === 'number' ? joined.purchase_price : 0;
        const qty = typeof ing.quantity_required === 'number' ? ing.quantity_required : Number(ing.quantity_required || 0);
        return total + qty * purchasePrice;
      }, 0);

      const isAvailable = productIngredients.every((ing: any) => {
        const joined = Array.isArray(ing.products) ? ing.products[0] : ing.products;
        const totalUnits = typeof joined?.total_units === 'number' ? joined.total_units : 0;
        const qty = typeof ing.quantity_required === 'number' ? ing.quantity_required : Number(ing.quantity_required || 0);
        return totalUnits >= qty;
      });

      return {
        ...(product as any),
        media: mediaMap[product.id] || [],
        cost_of_goods: costOfGoods,
        profit_margin: product.sale_price - costOfGoods,
        is_available: isAvailable,
        ingredients: productIngredients.map((ing: any) => {
          const joined = Array.isArray(ing.products) ? ing.products[0] : ing.products;
          return {
            ...ing,
            product_name: typeof joined?.name === 'string' ? joined.name : undefined,
            product_sku: typeof joined?.sku === 'string' ? joined.sku : undefined,
            product_purchase_price: typeof joined?.purchase_price === 'number' ? joined.purchase_price : undefined,
            product_total_units: typeof joined?.total_units === 'number' ? joined.total_units : undefined,
          };
        }),
        included_products: productIncludes.map((inc: any) => {
          const included = (inc as unknown as { included?: { id: string; name: string; sale_price: number; image_url: string | null } | null }).included ?? null;
          return {
            parent_sale_product_id: inc.parent_sale_product_id,
            included_sale_product_id: inc.included_sale_product_id,
            quantity: Number(inc.quantity || 1),
            included_product_name: included?.name,
            included_product_sale_price: typeof included?.sale_price === 'number' ? included.sale_price : undefined,
            included_product_image_url: included?.image_url ?? null,
          };
        }),
        category_name: (Array.isArray((product as any).sale_categories)
          ? (product as any).sale_categories?.[0]
          : (product as any).sale_categories
        )?.name,
        sub_category_name: (Array.isArray((product as any).sub_category)
          ? (product as any).sub_category?.[0]
          : (product as any).sub_category
        )?.name
      };
    });

    return { data: productsWithDetails, error: null };
  } catch (error) {
    console.error('Unexpected error fetching sale products:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function getSaleProduct(id: string): Promise<{ data: SaleProductWithDetails | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    // Get sale product with category
    const { data: product, error: productError } = await supabase
      .from('sale_products')
      .select(`
        *,
        sale_categories!sale_category_id(name)
      `)
      .eq('id', id)
      .single();

    if (productError) {
      console.error('Error fetching sale product:', productError);
      return { data: null, error: productError.message };
    }

    // Get ingredients
    // Get media
    const { data: media, error: mediaError } = await supabase
      .from('sale_product_media')
      .select('*')
      .eq('sale_product_id', id)
      .order('sort_order', { ascending: true });
    // Ignore mediaError for now (optional)
    const { data: ingredients, error: ingredientsError } = await supabase
      .from('sale_product_ingredients')
      .select(`
        *,
        products!product_id(name, sku, purchase_price, total_units)
      `)
      .eq('sale_product_id', id);

    if (ingredientsError) {
      console.error('Error fetching ingredients:', ingredientsError);
      return { data: null, error: ingredientsError.message };
    }

    // Get bundle/pack includes
    const { data: includes, error: includesError } = await supabase
      .from('sale_product_includes')
      .select(`
        parent_sale_product_id,
        included_sale_product_id,
        quantity,
        included:sale_products!included_sale_product_id(id, name, sale_price, image_url)
      `)
      .eq('parent_sale_product_id', id);

    if (includesError) {
      console.error('Error fetching sale product includes:', includesError);
      return { data: null, error: includesError.message };
    }

    // Calculate cost of goods using unit prices
    const costOfGoods = ingredients?.reduce((total, ing) => {
      const product = ing.products as { purchase_price: number; units_per_box: number } | null;
      if (!product) return total;

      // Calculate unit price: box price / units per box
      const unitPrice = product.purchase_price / (product.units_per_box || 1);
      return total + (ing.quantity_required * unitPrice);
    }, 0) || 0;

    // Check availability
    const isAvailable = ingredients?.every(ing => {
      const product = ing.products as { total_units: number } | null;
      return (product?.total_units || 0) >= ing.quantity_required;
    }) || false;

    const productWithDetails: SaleProductWithDetails & { media?: ProductMedia[] } = {
      ...product,
      media: media || [],
      cost_of_goods: costOfGoods,
      profit_margin: product.sale_price - costOfGoods,
      is_available: isAvailable,
      ingredients: ingredients?.map(ing => {
        const product = ing.products as { name: string; sku: string; purchase_price: number; total_units: number; units_per_box: number } | null;
        const unitPrice = product ? product.purchase_price / (product.units_per_box || 1) : 0;

        return {
          ...ing,
          product_name: product?.name,
          product_sku: product?.sku,
          product_purchase_price: product?.purchase_price,
          product_unit_price: unitPrice,
          product_total_units: product?.total_units,
          product_units_per_box: product?.units_per_box
        };
      }) || [],
      included_products: (includes || []).map((inc) => {
        const included = (inc as unknown as { included?: { id: string; name: string; sale_price: number; image_url: string | null } | null }).included ?? null;
        return {
          parent_sale_product_id: inc.parent_sale_product_id,
          included_sale_product_id: inc.included_sale_product_id,
          quantity: Number(inc.quantity || 1),
          included_product_name: included?.name,
          included_product_sale_price: typeof included?.sale_price === 'number' ? included.sale_price : undefined,
          included_product_image_url: included?.image_url ?? null,
        };
      }),
      category_name: (product.sale_categories as { name: string } | null)?.name,
      sub_category_name: (product.sub_category as { name: string } | null)?.name
    };

    return { data: productWithDetails, error: null };
  } catch (error) {
    console.error('Unexpected error fetching sale product:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function createSaleProduct(formData: {
  name: string;
  description?: string;
  section?: string;
  search_term?: string;
  slug?: string;
  seo_title?: string;
  seo_description?: string;
  seo_text?: string;
  sort_order?: number;
  sale_price: number;
  image_url?: string;
  sale_category_id?: string;
  sub_category_id?: string;
  is_featured?: boolean;
  preparation_time_minutes?: number;
  warning_threshold_units?: number | null;
  alert_threshold_units?: number | null;
  ingredients: Array<{
    product_id: string;
    quantity_required: number;
    unit_of_measure: string;
    is_optional: boolean;
    customer_can_remove: boolean;
    notes?: string;
  }>;
  included_products?: Array<{
    included_sale_product_id: string;
    quantity: number;
  }>;
  addon_group_ids?: string[];
}): Promise<{ data: SaleProduct | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    // Create sale product
    const { data: product, error: productError } = await supabase
      .from('sale_products')
      .insert([{
        name: formData.name,
        description: formData.description || null,
        section: formData.section?.trim() || null,
        search_term: formData.search_term && formData.search_term.trim() ? formData.search_term.trim() : null,
        slug: formData.slug && formData.slug.trim() ? formData.slug.trim() : null,
        seo_title: formData.seo_title && formData.seo_title.trim() ? formData.seo_title.trim() : null,
        seo_description: formData.seo_description && formData.seo_description.trim() ? formData.seo_description.trim() : null,
        seo_text: formData.seo_text && formData.seo_text.trim() ? formData.seo_text.trim() : null,
        sort_order: formData.sort_order || 0,
        sale_price: formData.sale_price,
        image_url: formData.image_url || null,
        sale_category_id: formData.sale_category_id || null,
        sub_category_id: formData.sub_category_id || null,
        is_featured: formData.is_featured || false,
        preparation_time_minutes: formData.preparation_time_minutes || 0,
        warning_threshold_units: formData.warning_threshold_units ?? null,
        alert_threshold_units: formData.alert_threshold_units ?? null
      }])
      .select()
      .single();

    if (productError) {
      console.error('Error creating sale product:', productError);
      return { data: null, error: productError.message };
    }

    // Create ingredients
    if (formData.ingredients.length > 0) {
      const ingredientsData = formData.ingredients.map(ing => ({
        sale_product_id: product.id,
        product_id: ing.product_id,
        quantity_required: ing.quantity_required,
        unit_of_measure: ing.unit_of_measure,
        is_optional: ing.is_optional,
        customer_can_remove: ing.customer_can_remove,
        notes: ing.notes || null
      }));

      const { error: ingredientsError } = await supabase
        .from('sale_product_ingredients')
        .insert(ingredientsData);

      if (ingredientsError) {
        console.error('Error creating ingredients:', ingredientsError);
        // Rollback: delete the created product
        await supabase.from('sale_products').delete().eq('id', product.id);
        return { data: null, error: ingredientsError.message };
      }
    }

    // Create add-on group relationships
    if (formData.addon_group_ids && formData.addon_group_ids.length > 0) {
      const addonRelationships = formData.addon_group_ids.map((addon_group_id, index) => ({
        sale_product_id: product.id,
        addon_group_id,
        display_order: index,
      }));

      const { error: addonError } = await supabase
        .from('sale_product_addon_groups')
        .insert(addonRelationships);

      if (addonError) {
        console.error('Error creating add-on group relationships:', addonError);
        // Rollback: delete the created product
        await supabase.from('sale_products').delete().eq('id', product.id);
        return { data: null, error: addonError.message };
      }
    }

    // Create bundle/pack includes
    if (formData.included_products && formData.included_products.length > 0) {
      const includeRows = formData.included_products
        .filter((i) => Boolean(i.included_sale_product_id))
        .map((i) => ({
          parent_sale_product_id: product.id,
          included_sale_product_id: i.included_sale_product_id,
          quantity: Math.max(1, Number(i.quantity || 1)),
        }));

      if (includeRows.length > 0) {
        const { error: includesInsertError } = await supabase
          .from('sale_product_includes')
          .insert(includeRows);

        if (includesInsertError) {
          console.error('Error creating bundle includes:', includesInsertError);
          await supabase.from('sale_products').delete().eq('id', product.id);
          return { data: null, error: includesInsertError.message };
        }
      }
    }

    return { data: product, error: null };
  } catch (error) {
    console.error('Unexpected error creating sale product:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Simple function to update just the image URL
export async function updateSaleProductImage(
  id: string,
  imageUrl: string
): Promise<{ data: SaleProduct | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data: product, error } = await supabase
      .from('sale_products')
      .update({ image_url: imageUrl })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating sale product image:', error);
      return { data: null, error: error.message };
    }

    return { data: product, error: null };
  } catch (error) {
    console.error('Error updating sale product image:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to update product image'
    };
  }
}

export async function updateSaleProduct(
  id: string,
  formData: {
    name: string;
    description?: string;
    section?: string;
    search_term?: string;
    slug?: string;
    seo_title?: string;
    seo_description?: string;
    seo_text?: string;
    sort_order?: number;
    sale_price: number;
    image_url?: string;
    sale_category_id?: string;
    sub_category_id?: string;
    is_featured?: boolean;
    preparation_time_minutes?: number;
    is_active?: boolean;
    warning_threshold_units?: number | null;
    alert_threshold_units?: number | null;
    ingredients: Array<{
      product_id: string;
      quantity_required: number;
      unit_of_measure: string;
      is_optional: boolean;
      customer_can_remove: boolean;
      notes?: string;
    }>;
    included_products?: Array<{
      included_sale_product_id: string;
      quantity: number;
    }>;
    addon_group_ids?: string[];
  }
): Promise<{ data: SaleProduct | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    // Update sale product
    const { data: product, error: productError } = await supabase
      .from('sale_products')
      .update({
        name: formData.name,
        description: formData.description || null,
        section: formData.section?.trim() || null,
        search_term: formData.search_term && formData.search_term.trim() ? formData.search_term.trim() : null,
        slug: formData.slug && formData.slug.trim() ? formData.slug.trim() : null,
        seo_title: formData.seo_title && formData.seo_title.trim() ? formData.seo_title.trim() : null,
        seo_description: formData.seo_description && formData.seo_description.trim() ? formData.seo_description.trim() : null,
        seo_text: formData.seo_text && formData.seo_text.trim() ? formData.seo_text.trim() : null,
        sort_order: formData.sort_order || 0,
        sale_price: formData.sale_price,
        image_url: formData.image_url || null,
        sale_category_id: formData.sale_category_id || null,
        sub_category_id: formData.sub_category_id || null,
        is_featured: formData.is_featured ?? false,
        preparation_time_minutes: formData.preparation_time_minutes || 0,
        is_active: formData.is_active !== undefined ? formData.is_active : true,
        warning_threshold_units: formData.warning_threshold_units ?? null,
        alert_threshold_units: formData.alert_threshold_units ?? null
      })
      .eq('id', id)
      .select()
      .single();

    if (productError) {
      console.error('Error updating sale product:', productError);
      return { data: null, error: productError.message };
    }

    // Update ingredients (delete all and recreate)
    const { error: deleteError } = await supabase
      .from('sale_product_ingredients')
      .delete()
      .eq('sale_product_id', id);

    if (deleteError) {
      console.error('Error deleting old ingredients:', deleteError);
      return { data: null, error: deleteError.message };
    }

    // Create new ingredients
    if (formData.ingredients.length > 0) {
      const ingredientsData = formData.ingredients.map(ing => ({
        sale_product_id: id,
        product_id: ing.product_id,
        quantity_required: ing.quantity_required,
        unit_of_measure: ing.unit_of_measure,
        is_optional: ing.is_optional,
        customer_can_remove: ing.customer_can_remove,
        notes: ing.notes || null
      }));

      const { error: ingredientsError } = await supabase
        .from('sale_product_ingredients')
        .insert(ingredientsData);

      if (ingredientsError) {
        console.error('Error creating new ingredients:', ingredientsError);
        return { data: null, error: ingredientsError.message };
      }
    }

    // Update add-on group relationships (delete all and recreate)
    const { error: deleteAddonError } = await supabase
      .from('sale_product_addon_groups')
      .delete()
      .eq('sale_product_id', id);

    if (deleteAddonError) {
      console.error('Error deleting old add-on group relationships:', deleteAddonError);
      return { data: null, error: deleteAddonError.message };
    }

    // Create new add-on group relationships
    if (formData.addon_group_ids && formData.addon_group_ids.length > 0) {
      const addonRelationships = formData.addon_group_ids.map((addon_group_id, index) => ({
        sale_product_id: id,
        addon_group_id,
        display_order: index,
      }));

      const { error: addonError } = await supabase
        .from('sale_product_addon_groups')
        .insert(addonRelationships);

      if (addonError) {
        console.error('Error creating add-on group relationships:', addonError);
        return { data: null, error: addonError.message };
      }
    }

    // Update bundle/pack includes (delete all and recreate)
    const { error: deleteIncludesError } = await supabase
      .from('sale_product_includes')
      .delete()
      .eq('parent_sale_product_id', id);

    if (deleteIncludesError) {
      console.error('Error deleting old bundle includes:', deleteIncludesError);
      return { data: null, error: deleteIncludesError.message };
    }

    if (formData.included_products && formData.included_products.length > 0) {
      const includeRows = formData.included_products
        .filter((i) => Boolean(i.included_sale_product_id))
        .map((i) => ({
          parent_sale_product_id: id,
          included_sale_product_id: i.included_sale_product_id,
          quantity: Math.max(1, Number(i.quantity || 1)),
        }));

      if (includeRows.length > 0) {
        const { error: includesInsertError } = await supabase
          .from('sale_product_includes')
          .insert(includeRows);

        if (includesInsertError) {
          console.error('Error creating bundle includes:', includesInsertError);
          return { data: null, error: includesInsertError.message };
        }
      }
    }

    return { data: product, error: null };
  } catch (error) {
    console.error('Unexpected error updating sale product:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function deleteSaleProduct(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    // Delete ingredients first (cascade should handle this, but being explicit)
    const { error: ingredientsError } = await supabase
      .from('sale_product_ingredients')
      .delete()
      .eq('sale_product_id', id);

    if (ingredientsError) {
      console.error('Error deleting ingredients:', ingredientsError);
      return { error: ingredientsError.message };
    }

    // Delete sale product
    const { error: productError } = await supabase
      .from('sale_products')
      .delete()
      .eq('id', id);

    if (productError) {
      console.error('Error deleting sale product:', productError);
      return { error: productError.message };
    }

    return { error: null };
  } catch (error) {
    console.error('Unexpected error deleting sale product:', error);
    return { error: 'An unexpected error occurred' };
  }
}

export async function setSaleProductSortOrders(
  updates: Array<{ id: string; sort_order: number }>
): Promise<{ error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from('sale_products')
          .update({ sort_order: u.sort_order })
          .eq('id', u.id)
      )
    );

    const firstError = results.find((r) => r.error)?.error;
    if (firstError) {
      console.error('Error updating sale product sort orders:', firstError);
      return { error: firstError.message };
    }

    return { error: null };
  } catch (error) {
    console.error('Unexpected error updating sale product sort orders:', error);
    return { error: 'An unexpected error occurred' };
  }
}

// Helper function to get available products for ingredient selection
export async function getAvailableProducts(): Promise<{
  data: Array<{
    id: string;
    name: string;
    sku: string;
    purchase_price: number;
    unit_price: number;
    total_units: number;
    units_per_box: number;
  }> | null; error: string | null
}> {
  try {
    const supabase = await createServiceRoleClient();

    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, purchase_price, total_units, units_per_box')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching available products:', error);
      return { data: null, error: error.message };
    }

    // Calculate unit prices for each product
    const productsWithUnitPrices = data?.map(product => ({
      ...product,
      unit_price: product.purchase_price / (product.units_per_box || 1)
    })) || [];

    return { data: productsWithUnitPrices, error: null };
  } catch (error) {
    console.error('Unexpected error fetching available products:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}
