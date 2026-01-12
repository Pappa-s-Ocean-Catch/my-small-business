'use server';

import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { CartItemData } from './cart';

export interface OrderInput {
  customer_email: string;
  customer_phone: string;
  customer_name?: string;
  payment_method: 'online' | 'store';
  user_id?: string; // Optional: for logged-in customers
  special_instructions?: string;
  items: CartItemData[];
  subtotal: number;
  tax?: number;
  delivery_fee?: number;
  service_fee?: number;
  total: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_description: string | null;
  product_image_url: string | null;
  base_price: number;
  quantity: number;
  subtotal: number;
  comment: string | null;
  created_at: string;
  addons?: OrderItemAddon[];
}

export interface OrderItemAddon {
  id: string;
  order_item_id: string;
  addon_group_id: string;
  addon_group_name: string;
  addon_item_id: string;
  addon_item_name: string;
  addon_item_price: number;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_email: string;
  customer_phone: string;
  customer_name: string | null;
  payment_method: 'online' | 'store';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  order_status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  subtotal: number;
  tax: number;
  delivery_fee: number;
  service_fee: number;
  total: number;
  special_instructions: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

// Create a new order from cart
export async function createOrder(input: OrderInput): Promise<{ data: Order | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    // Validate input
    if (!input.customer_email || !input.customer_phone) {
      return { data: null, error: 'Email and phone number are required' };
    }

    if (!input.items || input.items.length === 0) {
      return { data: null, error: 'Order must contain at least one item' };
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: input.user_id || null,
        customer_email: input.customer_email,
        customer_phone: input.customer_phone,
        customer_name: input.customer_name || null,
        payment_method: input.payment_method,
        payment_status: input.payment_method === 'online' ? 'pending' : 'pending', // Will be updated when payment is processed
        order_status: 'pending',
        subtotal: input.subtotal,
        tax: input.tax || 0,
        delivery_fee: input.delivery_fee || 0,
        service_fee: input.service_fee || 0,
        total: input.total,
        special_instructions: input.special_instructions || null
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return { data: null, error: orderError.message };
    }

    if (!order) {
      return { data: null, error: 'Failed to create order' };
    }

    // Create order items
    const orderItemsToInsert = input.items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_description: item.product_description || null,
      product_image_url: item.product_image_url || null,
      base_price: item.base_price,
      quantity: item.quantity,
      subtotal: item.subtotal,
      comment: item.comment || null
    }));

    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsToInsert)
      .select();

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      // Try to delete the order if items failed
      await supabase.from('orders').delete().eq('id', order.id);
      return { data: null, error: itemsError.message };
    }

    // Create order item addons
    if (orderItems && orderItems.length > 0) {
      const addonsToInsert: Array<{
        order_item_id: string;
        addon_group_id: string;
        addon_group_name: string;
        addon_item_id: string;
        addon_item_name: string;
        addon_item_price: number;
      }> = [];

      input.items.forEach((item, index) => {
        const orderItemId = orderItems[index]?.id;
        if (orderItemId && item.addons) {
          item.addons.forEach(addon => {
            addonsToInsert.push({
              order_item_id: orderItemId,
              addon_group_id: addon.addon_group_id,
              addon_group_name: addon.addon_group_name,
              addon_item_id: addon.addon_item_id,
              addon_item_name: addon.addon_item_name,
              addon_item_price: addon.addon_item_price
            });
          });
        }
      });

      if (addonsToInsert.length > 0) {
        const { error: addonsError } = await supabase
          .from('order_item_addons')
          .insert(addonsToInsert);

        if (addonsError) {
          console.error('Error creating order item addons:', addonsError);
          // Note: We don't delete the order here as items were created successfully
          // The addons can be added manually if needed
        }
      }
    }

    // Fetch complete order with items
    const completeOrder = await getOrder(order.id);
    return completeOrder;
  } catch (error) {
    console.error('Unexpected error creating order:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Get a single order by order number
export async function getOrderByNumber(orderNumber: string): Promise<{ data: Order | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single();

    if (orderError) {
      console.error('Error fetching order by number:', orderError);
      return { data: null, error: orderError.message };
    }

    if (!order) {
      return { data: null, error: 'Order not found' };
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      return { data: { ...order, items: [] }, error: null };
    }

    // Fetch addons for each item
    const itemsWithAddons: OrderItem[] = [];
    if (items) {
      for (const item of items) {
        const { data: addons, error: addonsError } = await supabase
          .from('order_item_addons')
          .select('*')
          .eq('order_item_id', item.id);

        if (addonsError) {
          console.error('Error fetching order item addons:', addonsError);
        }

        itemsWithAddons.push({
          ...item,
          base_price: Number(item.base_price),
          quantity: item.quantity,
          subtotal: Number(item.subtotal),
          addons: addons || []
        });
      }
    }

    return {
      data: {
        ...order,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        delivery_fee: Number(order.delivery_fee),
        service_fee: Number(order.service_fee),
        total: Number(order.total),
        items: itemsWithAddons
      },
      error: null
    };
  } catch (error) {
    console.error('Unexpected error fetching order by number:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Get a single order by ID
export async function getOrder(orderId: string): Promise<{ data: Order | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      return { data: null, error: orderError.message };
    }

    if (!order) {
      return { data: null, error: 'Order not found' };
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      return { data: { ...order, items: [] }, error: null };
    }

    // Fetch addons for each item
    const itemsWithAddons: OrderItem[] = [];
    if (items) {
      for (const item of items) {
        const { data: addons, error: addonsError } = await supabase
          .from('order_item_addons')
          .select('*')
          .eq('order_item_id', item.id);

        if (addonsError) {
          console.error('Error fetching order item addons:', addonsError);
        }

        itemsWithAddons.push({
          ...item,
          base_price: Number(item.base_price),
          quantity: item.quantity,
          subtotal: Number(item.subtotal)
        });
      }
    }

    return {
      data: {
        ...order,
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        delivery_fee: Number(order.delivery_fee),
        service_fee: Number(order.service_fee),
        total: Number(order.total),
        items: itemsWithAddons
      },
      error: null
    };
  } catch (error) {
    console.error('Unexpected error fetching order:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Get all orders (for admin)
export async function getAllOrders(filters?: {
  status?: string;
  payment_status?: string;
  limit?: number;
}): Promise<{ data: Order[] | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('order_status', filters.status);
    }

    if (filters?.payment_status) {
      query = query.eq('payment_status', filters.payment_status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return { data: null, error: ordersError.message };
    }

    // Fetch items for each order
    const ordersWithItems: Order[] = [];
    if (orders) {
      for (const order of orders) {
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id)
          .order('created_at', { ascending: true });

        if (itemsError) {
          console.error('Error fetching order items:', itemsError);
        }

        ordersWithItems.push({
          ...order,
          subtotal: Number(order.subtotal),
          tax: Number(order.tax),
          delivery_fee: Number(order.delivery_fee),
          service_fee: Number(order.service_fee),
          total: Number(order.total),
          items: items?.map(item => ({
            ...item,
            base_price: Number(item.base_price),
            quantity: item.quantity,
            subtotal: Number(item.subtotal)
          })) || []
        });
      }
    }

    return { data: ordersWithItems, error: null };
  } catch (error) {
    console.error('Unexpected error fetching orders:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Update order status
export async function updateOrderStatus(
  orderId: string,
  status: Order['order_status']
): Promise<{ data: Order | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .update({ order_status: status })
      .eq('id', orderId)
      .select()
      .single();

    if (orderError) {
      console.error('Error updating order status:', orderError);
      return { data: null, error: orderError.message };
    }

    if (!order) {
      return { data: null, error: 'Order not found' };
    }

    return getOrder(orderId);
  } catch (error) {
    console.error('Unexpected error updating order status:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Update payment status
export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: Order['payment_status']
): Promise<{ data: Order | null; error: string | null }> {
  try {
    const supabase = await createServiceRoleClient();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .update({ payment_status: paymentStatus })
      .eq('id', orderId)
      .select()
      .single();

    if (orderError) {
      console.error('Error updating payment status:', orderError);
      return { data: null, error: orderError.message };
    }

    if (!order) {
      return { data: null, error: 'Order not found' };
    }

    return getOrder(orderId);
  } catch (error) {
    console.error('Unexpected error updating payment status:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}

// Get customer orders (respects RLS - customers can only see their own orders)
export async function getCustomerOrders(): Promise<{ data: Order[] | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { data: null, error: 'Not authenticated' };
    }

    // Fetch orders for this user (RLS will filter automatically)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching customer orders:', ordersError);
      return { data: null, error: ordersError.message };
    }

    // Fetch items and addons for each order
    const ordersWithItems: Order[] = [];
    if (orders) {
      for (const order of orders) {
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id)
          .order('created_at', { ascending: true });

        if (itemsError) {
          console.error('Error fetching order items:', itemsError);
        }

        const itemsWithAddons: OrderItem[] = [];
        if (items) {
          for (const item of items) {
            const { data: addons } = await supabase
              .from('order_item_addons')
              .select('*')
              .eq('order_item_id', item.id);

            itemsWithAddons.push({
              ...item,
              base_price: Number(item.base_price),
              quantity: item.quantity,
              subtotal: Number(item.subtotal),
              addons: addons?.map(addon => ({
                id: addon.id,
                order_item_id: addon.order_item_id,
                addon_group_id: addon.addon_group_id,
                addon_group_name: addon.addon_group_name,
                addon_item_id: addon.addon_item_id,
                addon_item_name: addon.addon_item_name,
                addon_item_price: Number(addon.addon_item_price),
                created_at: addon.created_at
              })) || []
            });
          }
        }

        ordersWithItems.push({
          ...order,
          subtotal: Number(order.subtotal),
          tax: Number(order.tax),
          delivery_fee: Number(order.delivery_fee),
          service_fee: Number(order.service_fee),
          total: Number(order.total),
          items: itemsWithAddons
        });
      }
    }

    return { data: ordersWithItems, error: null };
  } catch (error) {
    console.error('Unexpected error fetching customer orders:', error);
    return { data: null, error: 'An unexpected error occurred' };
  }
}
