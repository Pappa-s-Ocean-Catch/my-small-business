import { supabase } from './supabase';
import type { Order, OrderItem, OrderItemAddon, OrderStatus, PaymentStatus } from '@my-small-business/types';

type OrderRow = Omit<Order, 'items'> & {
  items?: never;
};

type OrderWithEmbeddedItemsRow = OrderRow & {
  order_items?: Array<(OrderItem & { order_item_addons?: OrderItemAddon[] | null })> | null;
};

function mapEmbeddedOrder(row: OrderWithEmbeddedItemsRow): Order {
  const items: OrderItem[] =
    (row.order_items || []).map((item) => ({
      ...item,
      base_price: Number(item.base_price),
      subtotal: Number(item.subtotal),
      removed_ingredients: (item.removed_ingredients as string[] | null) || [],
      addons: (item.order_item_addons || undefined) ?? undefined,
    })) || [];

  // Strip embedded fields from base row
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { order_items, ...rest } = row as unknown as { order_items?: unknown } & OrderRow;
  return {
    ...(rest as unknown as Order),
    items,
  };
}

export async function getAllOrders(filters?: {
  status?: string;
  payment_status?: string;
  date?: string;
  since?: string;
}): Promise<{ data: Order[] | null; error: string | null }> {
  try {
    let query = supabase
      .from('orders')
      .select('*, order_items(*, order_item_addons(*))')
      .order('created_at', { ascending: false });


    if (filters?.status && filters.status !== 'all') {
      query = query.eq('order_status', filters.status);
    } else if (!filters?.status || filters.status === 'all') {
      // Exclude pending_online_payment from live orders
      query = query.neq('order_status', 'pending_online_payment');
    }

    if (filters?.payment_status && filters.payment_status !== 'all') {
      query = query.eq('payment_status', filters.payment_status);
    }

    if (filters?.since) {
      query = query.gte('created_at', filters.since);
    } else if (filters?.date) {
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

    const mapped = (data as unknown as OrderWithEmbeddedItemsRow[]).map(mapEmbeddedOrder);
    return { data: mapped, error: null };
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
      .select('*, order_items(*, order_item_addons(*))')
      .eq('id', orderId)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    if (!data) {
      return { data: null, error: 'Order not found' };
    }

    return { data: mapEmbeddedOrder(data as unknown as OrderWithEmbeddedItemsRow), error: null };
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
  paymentStatus: PaymentStatus,
  paymentMethodDetail?: string | null
): Promise<{ data: Order | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({
        payment_status: paymentStatus,
        payment_method_detail: paymentMethodDetail ?? null,
        updated_at: new Date().toISOString(),
      })
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
