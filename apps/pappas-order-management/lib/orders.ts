import { supabase } from './supabase';
import type { Order, OrderItem, OrderItemAddon, OrderStatus, PaymentStatus } from '@my-small-business/types';
import { getOrderNotes, getOrderOptions } from '../utils/orderUtils';

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
  const mappedOrder = rest as unknown as Order;
  return {
    ...mappedOrder,
    subtotal: Number(mappedOrder.subtotal ?? 0),
    tax: Number(mappedOrder.tax ?? 0),
    delivery_fee: Number(mappedOrder.delivery_fee ?? 0),
    service_fee: Number(mappedOrder.service_fee ?? 0),
    promotion_discount: Number(mappedOrder.promotion_discount ?? 0),
    coupon_discount: Number(mappedOrder.coupon_discount ?? 0),
    reward_points_used: mappedOrder.reward_points_used == null ? null : Number(mappedOrder.reward_points_used),
    reward_points_value: mappedOrder.reward_points_value == null ? null : Number(mappedOrder.reward_points_value),
    total: Number(mappedOrder.total ?? 0),
    items,
  };
}

function normalizeOrderOptions<T extends { order_options?: string | null; special_instructions?: string | null }>(
  payload: T
): T {
  const hasOrderOptions = Object.prototype.hasOwnProperty.call(payload, 'order_options');
  const hasSpecialInstructions = Object.prototype.hasOwnProperty.call(payload, 'special_instructions');

  if (!hasOrderOptions && !hasSpecialInstructions) {
    return payload;
  }

  const orderOptions = getOrderOptions({
    order_options: payload.order_options ?? null,
    special_instructions: payload.special_instructions ?? null,
  });

  return {
    ...payload,
    ...(hasOrderOptions || orderOptions.length > 0
      ? { order_options: orderOptions.length > 0 ? orderOptions.join(',') : null }
      : {}),
    ...(hasSpecialInstructions
      ? { special_instructions: getOrderNotes({ special_instructions: payload.special_instructions ?? null }) }
      : {}),
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
  status: OrderStatus,
  paymentStatus?: PaymentStatus,
  paymentMethodDetail?: string | null
): Promise<{ data: Order | null; error: string | null }> {
  try {
    const updatePayload: any = {
      order_status: status,
      updated_at: new Date().toISOString(),
    };

    if (paymentStatus) {
      updatePayload.payment_status = paymentStatus;
    }
    if (paymentMethodDetail !== undefined) {
      updatePayload.payment_method_detail = paymentMethodDetail;
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updatePayload)
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

export async function claimOrderForAutoPrint(orderId: string): Promise<{ claimed: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({
        order_status: 'preparing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .in('order_status', ['pending', 'confirmed'])
      .neq('payment_status', 'refunded')
      .select('id')
      .maybeSingle();

    if (error) {
      return { claimed: false, error: error.message };
    }

    return { claimed: Boolean(data), error: null };
  } catch (error) {
    console.error('Error claiming order for auto print:', error);
    return {
      claimed: false,
      error: error instanceof Error ? error.message : 'Failed to claim order for auto print',
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

export async function savePosOrder(
  orderPayload: Omit<Order, 'id' | 'order_number' | 'created_at' | 'updated_at' | 'items'>,
  items: Array<Omit<OrderItem, 'id' | 'order_id' | 'created_at' | 'addons'> & { addons?: Omit<OrderItemAddon, 'id' | 'order_item_id' | 'created_at'>[] }>
): Promise<{ data: Order | null; error: string | null }> {
  try {
    const normalizedOrderPayload = normalizeOrderOptions(orderPayload);
    const finalOrderStatus = normalizedOrderPayload.order_status;
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        ...normalizedOrderPayload,
        order_status: 'pending_online_payment',
      })
      .select()
      .single();

    if (orderError) throw new Error(orderError.message);
    const orderId = orderData.id;

    for (const item of items) {
      const { addons, order_item_addons, id, order_id, created_at, ...itemData } = item as any;
      const { data: insertedItem, error: itemError } = await supabase
        .from('order_items')
        .insert({
          ...itemData,
          order_id: orderId,
        })
        .select()
        .single();

      if (itemError) throw new Error(itemError.message);
      const itemId = insertedItem.id;

      if (addons && addons.length > 0) {
        const addonsToInsert = addons.map((addon: any) => ({
          order_item_id: itemId,
          addon_group_id: addon.addon_group_id,
          addon_group_name: addon.addon_group_name,
          addon_item_id: addon.addon_item_id,
          addon_item_name: addon.addon_item_name,
          addon_item_price: addon.addon_item_price,
        }));
        
        const { error: addonError } = await supabase
          .from('order_item_addons')
          .insert(addonsToInsert);

        if (addonError) throw new Error(addonError.message);
      }
    }

    const { error: finalStatusError } = await supabase
      .from('orders')
      .update({
        order_status: finalOrderStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (finalStatusError) throw new Error(finalStatusError.message);

    return getOrder(orderId);
  } catch (error) {
    console.error('Error saving POS order:', error);
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updatePosOrder(
  orderId: string,
  updatedItems: Array<Omit<OrderItem, 'id' | 'order_id' | 'created_at' | 'addons'> & { addons?: Omit<OrderItemAddon, 'id' | 'order_item_id' | 'created_at'>[] }>,
  orderTotalsUpdate: { subtotal: number; tax: number; total: number },
  orderUpdate: Partial<Pick<Order,
    'user_id'
    | 'customer_phone'
    | 'customer_name'
    | 'payment_method'
    | 'order_channel'
    | 'payment_status'
    | 'payment_method_detail'
    | 'order_options'
    | 'special_instructions'
    | 'scheduled_pickup_at'
  >> = {}
): Promise<{ data: Order | null; error: string | null }> {
  try {
    const normalizedOrderUpdate = normalizeOrderOptions(orderUpdate);

    // Update order totals first
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        subtotal: orderTotalsUpdate.subtotal,
        tax: orderTotalsUpdate.tax,
        total: orderTotalsUpdate.total,
        ...normalizedOrderUpdate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (orderError) throw new Error(orderError.message);

    // Delete existing items and addons
    const { data: existingItems, error: existingItemsError } = await supabase
      .from('order_items')
      .select('id')
      .eq('order_id', orderId);
    if (existingItemsError) throw new Error(existingItemsError.message);

    const existingItemIds = (existingItems || []).map((item) => item.id);
    if (existingItemIds.length > 0) {
      const { error: deleteAddonError } = await supabase
        .from('order_item_addons')
        .delete()
        .in('order_item_id', existingItemIds);
      if (deleteAddonError) throw new Error(deleteAddonError.message);
    }
    await supabase.from('order_items').delete().eq('order_id', orderId);

    // Insert updated items
    for (const item of updatedItems) {
      const { addons, order_item_addons, id, order_id, created_at, ...itemData } = item as any;
      const { data: insertedItem, error: itemError } = await supabase
        .from('order_items')
        .insert({
          ...itemData,
          order_id: orderId,
        })
        .select()
        .single();

      if (itemError) throw new Error(itemError.message);
      const itemId = insertedItem.id;

      if (addons && addons.length > 0) {
        const addonsToInsert = addons.map((addon: any) => ({
          order_item_id: itemId,
          addon_group_id: addon.addon_group_id,
          addon_group_name: addon.addon_group_name,
          addon_item_id: addon.addon_item_id,
          addon_item_name: addon.addon_item_name,
          addon_item_price: addon.addon_item_price,
        }));
        const { error: addonError } = await supabase
          .from('order_item_addons')
          .insert(addonsToInsert);
        if (addonError) throw new Error(addonError.message);
      }
    }

    return getOrder(orderId);
  } catch (error) {
    console.error('Error updating POS order:', error);
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
