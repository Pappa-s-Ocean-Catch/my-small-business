'use server';

import { createServiceRoleClient } from '@/lib/supabase/server';

// Types
export interface SaleCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaleProduct {
  id: string;
  name: string;
  description: string | null;
  sale_price: number;
  image_url: string | null;
  sale_category_id: string | null;
  is_active: boolean;
  preparation_time_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface SaleProductIngredient {
  id: string;
  sale_product_id: string;
  product_id: string;
  quantity_required: number;
  unit_of_measure: string;
  is_optional: boolean;
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

export interface SaleProductWithDetails extends SaleProduct {
  cost_of_goods: number;
  profit_margin: number;
  is_available: boolean;
  ingredients: SaleProductIngredient[];
  category_name?: string;
}

// Sale Categories CRUD
export async function getSaleCategories(): Promise<{ data: SaleCategory[] | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    
    const { data, error } = await supabase
      .from('sale_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching sale categories:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Unexpected error fetching sale categories:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function createSaleCategory(formData: {
  name: string;
  description?: string;
  sort_order?: number;
}): Promise<{ data: SaleCategory | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    
    const { data, error } = await supabase
      .from('sale_categories')
      .insert([{
        name: formData.name,
        description: formData.description || null,
        sort_order: formData.sort_order || 0
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
    sort_order?: number;
    is_active?: boolean;
  }
): Promise<{ data: SaleCategory | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    
    const { data, error } = await supabase
      .from('sale_categories')
      .update({
        name: formData.name,
        description: formData.description || null,
        sort_order: formData.sort_order || 0,
        is_active: formData.is_active !== undefined ? formData.is_active : true
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

// Sale Products CRUD
export async function getSaleProducts(): Promise<{ data: SaleProductWithDetails[] | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    
    // Get sale products with category names
    const { data: products, error: productsError } = await supabase
      .from('sale_products')
      .select(`
        *,
        sale_categories!sale_category_id(name)
      `)
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
    const { data: ingredients, error: ingredientsError } = await supabase
      .from('sale_product_ingredients')
      .select(`
        *,
        products!product_id(name, sku, purchase_price, total_units)
      `)
      .in('sale_product_id', productIds);

    if (ingredientsError) {
      console.error('Error fetching ingredients:', ingredientsError);
      return { data: null, error: ingredientsError.message };
    }

    // Combine data and calculate costs
    const productsWithDetails: SaleProductWithDetails[] = products.map(product => {
      const productIngredients = ingredients?.filter(ing => ing.sale_product_id === product.id) || [];
      
      // Calculate cost of goods
      const costOfGoods = productIngredients.reduce((total, ing) => {
        const product = ing.products as { purchase_price: number } | null;
        return total + (ing.quantity_required * (product?.purchase_price || 0));
      }, 0);

      // Check availability
      const isAvailable = productIngredients.every(ing => {
        const product = ing.products as { total_units: number } | null;
        return (product?.total_units || 0) >= ing.quantity_required;
      });

      return {
        ...product,
        cost_of_goods: costOfGoods,
        profit_margin: product.sale_price - costOfGoods,
        is_available: isAvailable,
        ingredients: productIngredients.map(ing => ({
          ...ing,
          product_name: (ing.products as { name: string; sku: string; purchase_price: number; total_units: number } | null)?.name,
          product_sku: (ing.products as { name: string; sku: string; purchase_price: number; total_units: number } | null)?.sku,
          product_purchase_price: (ing.products as { name: string; sku: string; purchase_price: number; total_units: number } | null)?.purchase_price,
          product_total_units: (ing.products as { name: string; sku: string; purchase_price: number; total_units: number } | null)?.total_units
        })),
        category_name: (product.sale_categories as { name: string } | null)?.name
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

    const productWithDetails: SaleProductWithDetails = {
      ...product,
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
      category_name: (product.sale_categories as { name: string } | null)?.name
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
  sale_price: number;
  image_url?: string;
  sale_category_id?: string;
  preparation_time_minutes?: number;
  ingredients: Array<{
    product_id: string;
    quantity_required: number;
    unit_of_measure: string;
    is_optional: boolean;
    notes?: string;
  }>;
}): Promise<{ data: SaleProduct | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();
    
    // Create sale product
    const { data: product, error: productError } = await supabase
      .from('sale_products')
      .insert([{
        name: formData.name,
        description: formData.description || null,
        sale_price: formData.sale_price,
        image_url: formData.image_url || null,
        sale_category_id: formData.sale_category_id || null,
        preparation_time_minutes: formData.preparation_time_minutes || 0
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

    return { data: product, error: null };
  } catch (error) {
    console.error('Unexpected error creating sale product:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

export async function updateSaleProduct(
  id: string,
  formData: {
    name: string;
    description?: string;
    sale_price: number;
    image_url?: string;
    sale_category_id?: string;
    preparation_time_minutes?: number;
    is_active?: boolean;
    ingredients: Array<{
      product_id: string;
      quantity_required: number;
      unit_of_measure: string;
      is_optional: boolean;
      notes?: string;
    }>;
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
        sale_price: formData.sale_price,
        image_url: formData.image_url || null,
        sale_category_id: formData.sale_category_id || null,
        preparation_time_minutes: formData.preparation_time_minutes || 0,
        is_active: formData.is_active !== undefined ? formData.is_active : true
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

// Helper function to get available products for ingredient selection
export async function getAvailableProducts(): Promise<{ data: Array<{
  id: string;
  name: string;
  sku: string;
  purchase_price: number;
  unit_price: number;
  total_units: number;
  units_per_box: number;
}> | null; error: string | null }> {
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
