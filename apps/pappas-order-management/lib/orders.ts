import { supabase } from './supabase';
import type { Order, OrderItem, OrderItemAddon, OrderStatus, PaymentStatus } from '@my-small-business/types';

export async function getAllOrders(filters?: {
  status?: string;
  payment_status?: string;
  date?: string;
}): Promise<{ data: Order[] | null; error: string | null }> {
  try {
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('order_status', filters.status);
    }

    if (filters?.payment_status && filters.payment_status !== 'all') {
      query = query.eq('payment_status', filters.payment_status);
    }

    if (filters?.date) {
      const startDate = new Date(filters.date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(filters.date);
      endDate.setHours(23, 59, 59, 999);

      query = query
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    if (!data) {
      return { data: [], error: null };
    }

    // Fetch items and addons for each order
    const ordersWithItems: Order[] = [];
    for (const order of data) {
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });

      if (itemsError) {
        console.error('Error fetching order items:', itemsError);
        ordersWithItems.push(order as Order);
        continue;
      }

      const orderItems: OrderItem[] = [];
      if (items) {
        for (const item of items) {
          const { data: addons, error: addonsError } = await supabase
            .from('order_item_addons')
            .select('*')
            .eq('order_item_id', item.id)
            .order('created_at', { ascending: true });

          if (addonsError) {
            console.error('Error fetching addons:', addonsError);
          }

          orderItems.push({
            ...item,
            addons: addons || undefined,
          } as OrderItem);
        }
      }

      ordersWithItems.push({
        ...order,
        items: orderItems,
      } as Order);
    }

    return { data: ordersWithItems, error: null };
  } catch (error) {
    console.error('Error fetching orders:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch orders',
    };
  }
}

export async function getOrder(orderId: string): Promise<{ data: Order | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    if (!data) {
      return { data: null, error: 'Order not found' };
    }

    // Fetch items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      return { data: data as Order, error: null };
    }

    // Fetch addons for each item
    const orderItems: OrderItem[] = [];
    if (items) {
      for (const item of items) {
        const { data: addons, error: addonsError } = await supabase
          .from('order_item_addons')
          .select('*')
          .eq('order_item_id', item.id)
          .order('created_at', { ascending: true });

        if (addonsError) {
          console.error('Error fetching addons:', addonsError);
        }

        orderItems.push({
          ...item,
          addons: addons || undefined,
        } as OrderItem);
      }
    }

    return {
      data: {
        ...data,
        items: orderItems,
      } as Order,
      error: null,
    };
  } catch (error) {
    console.error('Error fetching order:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch order',
    };
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<{ data: Order | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ order_status: status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Order, error: null };
  } catch (error) {
    console.error('Error updating order status:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to update order status',
    };
  }
}

export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: PaymentStatus
): Promise<{ data: Order | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Order, error: null };
  } catch (error) {
    console.error('Error updating payment status:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to update payment status',
    };
  }
}
