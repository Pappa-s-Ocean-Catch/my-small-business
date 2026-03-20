"use server";

import { createServiceRoleClient } from "@my-small-business/supabase/server";

export interface TopSellerProduct {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
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
export async function getTopSellingProducts(limit: number = 20): Promise<{
  data: TopSellerProduct[] | null;
  error: string | null
}> {
  try {
    const supabase = await createServiceRoleClient();

    // Get date 7 days ago
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    // Get all order items from orders in the last 7 days
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('product_id, quantity, order_id, orders(created_at)')
      .not('product_id', 'is', null);

    if (orderItemsError) {
      console.error('Error fetching order items:', orderItemsError);
      return { data: null, error: orderItemsError.message };
    }

    if (!orderItems || orderItems.length === 0) {
      return { data: [], error: null };
    }

    // Filter order items to only those with order.created_at in last 7 days
    const recentOrderItems = orderItems.filter((item: any) => {
      const createdAt = item.orders?.created_at;
      return createdAt && createdAt >= sevenDaysAgoISO;
    });

    // Aggregate sales data by product
    const productSalesMap = new Map<string, {
      productId: string;
      totalQuantity: number;
      orderIds: Set<string>;
    }>();

    recentOrderItems.forEach((item: any) => {
      if (!item.product_id) return;

      const productId = item.product_id;

      if (!productSalesMap.has(productId)) {
        productSalesMap.set(productId, {
          productId,
          totalQuantity: 0,
          orderIds: new Set()
        });
      }

      const salesData = productSalesMap.get(productId)!;
      salesData.totalQuantity += item.quantity || 1;
      if (item.order_id) {
        salesData.orderIds.add(item.order_id);
      }
    });

    // Get product details for top selling products
    const productIds = Array.from(productSalesMap.keys());
    if (productIds.length === 0) {
      return { data: [], error: null };
    }
    const { data: products, error: productsError } = await supabase
      .from('sale_products')
      .select('id, slug, name, description, sale_price, image_url, sale_category_id, sub_category_id')
      .in('id', productIds)
      .eq('is_active', true);

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return { data: null, error: productsError.message };
    }

    // Combine sales data with product details
    const topSellingProducts: TopSellerProduct[] = (products || [])
      .map(product => {
        const salesData = productSalesMap.get(product.id);
        if (!salesData) return null;

        return {
          id: product.id,
          slug: product.slug ?? null,
          name: product.name,
          description: product.description,
          sale_price: Number(product.sale_price),
          image_url: product.image_url,
          sale_category_id: product.sale_category_id,
          sub_category_id: product.sub_category_id,
          total_quantity_sold: salesData.totalQuantity,
          total_orders: salesData.orderIds.size
        };
      })
      .filter((p): p is TopSellerProduct => p !== null)
      .sort((a, b) => b.total_quantity_sold - a.total_quantity_sold)
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
      .select('id, slug, name, description, sale_price, image_url, sale_category_id, sub_category_id')
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
