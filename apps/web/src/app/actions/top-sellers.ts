"use server";

import { createServiceRoleClient } from "@my-small-business/supabase/server";
import { getMelbourneTodayRange, rankTodayTopSellers, TODAY_TOP_SELLERS_LIMIT } from "@/lib/todays-top-sellers";

export interface TopSellerProduct {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  section: string | null;
  sale_price: number;
  image_url: string | null;
  sale_category_id: string | null;
  sub_category_id: string | null;
  total_quantity_sold: number;
  total_orders: number;
}

/**
 * Get top selling products based on order_items
 * Returns products sorted by total quantity sold
 */
export async function getTopSellingProducts(limit: number = TODAY_TOP_SELLERS_LIMIT): Promise<{
  data: TopSellerProduct[] | null;
  error: string | null
}> {
  try {
    const supabase = await createServiceRoleClient();

    const { startIso, endIso } = getMelbourneTodayRange(new Date());

    // Fetch only today's order items; customer pages receive only aggregated, product-level results.
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('product_id, quantity, order_id, orders!inner(created_at, order_status)')
      .not('product_id', 'is', null)
      .gte('orders.created_at', startIso)
      .lt('orders.created_at', endIso);

    if (orderItemsError) {
      console.error('Error fetching order items:', orderItemsError);
      return { data: null, error: orderItemsError.message };
    }

    if (!orderItems || orderItems.length === 0) {
      return { data: [], error: null };
    }

    const rankedSales = rankTodayTopSellers(orderItems.map((item: any) => {
      const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
      return {
        productId: item.product_id,
        quantity: item.quantity,
        orderId: item.order_id,
        orderStatus: order?.order_status ?? null,
      };
    }));

    // Get product details for top selling products
    const productIds = rankedSales.map((sale) => sale.productId);
    if (productIds.length === 0) {
      return { data: [], error: null };
    }
    const { data: products, error: productsError } = await supabase
      .from('sale_products')
      .select('id, slug, name, description, section, sale_price, image_url, sale_category_id, sub_category_id')
      .in('id', productIds)
      .eq('is_active', true);

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return { data: null, error: productsError.message };
    }

    // Combine sales data with product details
    const topSellingProducts: TopSellerProduct[] = (products || [])
      .map(product => {
        const salesData = rankedSales.find((sale) => sale.productId === product.id);
        if (!salesData) return null;

        return {
          id: product.id,
          slug: product.slug ?? null,
          name: product.name,
          description: product.description,
          section: product.section ?? null,
          sale_price: Number(product.sale_price),
          image_url: product.image_url,
          sale_category_id: product.sale_category_id,
          sub_category_id: product.sub_category_id,
          total_quantity_sold: salesData.quantitySold,
          total_orders: salesData.orderCount
        };
      })
      .filter((p): p is TopSellerProduct => p !== null)
      .sort((a, b) => b.total_quantity_sold - a.total_quantity_sold || a.id.localeCompare(b.id))
      .slice(0, limit);

    return { data: topSellingProducts, error: null };
  } catch (error) {
    console.error('Unexpected error fetching top sellers:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

/**
 * Get featured products (products marked as is_featured)
 */
export async function getFeaturedProducts(): Promise<{
  data: TopSellerProduct[] | null;
  error: string | null
}> {
  try {
    const supabase = await createServiceRoleClient();

    const { data: featuredProducts, error: featuredError } = await supabase
      .from('sale_products')
      .select('id, slug, name, description, section, sale_price, image_url, sale_category_id, sub_category_id')
      .eq('is_active', true)
      .eq('is_featured', true)
      .order('name');

    if (featuredError) {
      console.error('Error fetching featured products:', featuredError);
      return { data: null, error: featuredError.message };
    }

    if (!featuredProducts) {
      return { data: [], error: null };
    }

    // Get sales data for featured products
    const productIds = featuredProducts.map(p => p.id);
    const { data: salesData, error: salesError } = await supabase
      .from('order_items')
      .select('product_id, quantity')
      .in('product_id', productIds);

    // Aggregate sales data
    const salesMap = new Map<string, { quantity: number; orders: number }>();
    salesData?.forEach((item: any) => {
      if (!item.product_id) return;
      const current = salesMap.get(item.product_id) || { quantity: 0, orders: 0 };
      salesMap.set(item.product_id, {
        quantity: current.quantity + (item.quantity || 1),
        orders: current.orders + 1
      });
    });

    const productsWithSales: TopSellerProduct[] = featuredProducts.map(product => {
      const sales = salesMap.get(product.id) || { quantity: 0, orders: 0 };
      return {
        id: product.id,
        slug: product.slug ?? null,
        name: product.name,
        description: product.description,
        section: product.section ?? null,
        sale_price: Number(product.sale_price),
        image_url: product.image_url,
        sale_category_id: product.sale_category_id,
        sub_category_id: product.sub_category_id,
        total_quantity_sold: sales.quantity,
        total_orders: sales.orders
      };
    });

    return { data: productsWithSales, error: null };
  } catch (error) {
    console.error('Unexpected error fetching featured products:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}
