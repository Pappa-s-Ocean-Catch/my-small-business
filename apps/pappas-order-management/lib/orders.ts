import { supabase } from './supabase';
import type { Order, OrderItem, OrderItemAddon, OrderStatus, PaymentStatus } from '@my-small-business/types';
import { getOrderNotes, getOrderOptions } from '../utils/orderUtils';
import type { DeliveryAddressDraft, DeliveryQuoteResult } from './delivery';
import { ensureRewardPointsForOrder } from './reward-points';

type OrderRow = Omit<Order, 'items'> & {
  items?: never;
};

type OrderWithEmbeddedItemsRow = OrderRow & {
  order_items?: Array<(OrderItem & { order_item_addons?: OrderItemAddon[] | null })> | null;
};

function generateReceiptClaimToken(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const tokenLength = 8;
  let token = '';

  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(tokenLength);
    globalThis.crypto.getRandomValues(values);
    for (let index = 0; index < tokenLength; index += 1) {
      token += alphabet[values[index] % alphabet.length];
    }
    return token;
  }

  for (let index = 0; index < tokenLength; index += 1) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return token;
}

function shouldGenerateReceiptClaimToken(orderPayload: Pick<Order, 'order_channel' | 'customer_name' | 'user_id' | 'receipt_claim_token'>): boolean {
  const normalizedCustomerName = orderPayload.customer_name?.trim().toUpperCase() ?? '';
  return (
    orderPayload.order_channel === 'instore' &&
    normalizedCustomerName === 'INSTORE' &&
    !orderPayload.user_id &&
    !orderPayload.receipt_claim_token
  );
}

async function ensureReceiptClaimTokenForOrder(order: Order): Promise<Order> {
  if (!shouldGenerateReceiptClaimToken(order)) {
    return order;
  }

  const receiptClaimToken = generateReceiptClaimToken();
  console.log('[ensureReceiptClaimTokenForOrder] backfilling token', {
    orderId: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    userId: order.user_id,
    generatedReceiptClaimToken: receiptClaimToken,
  });

  const { data, error } = await supabase
    .from('orders')
    .update({
      receipt_claim_token: receiptClaimToken,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .is('receipt_claim_token', null)
    .select('*, order_items(*, order_item_addons(*))')
    .single();

  if (error) {
    console.warn('[ensureReceiptClaimTokenForOrder] failed to backfill token', {
      orderId: order.id,
      error: error.message,
    });
    return order;
  }

  const updatedOrder = mapEmbeddedOrder(data as unknown as OrderWithEmbeddedItemsRow);
  console.log('[ensureReceiptClaimTokenForOrder] backfilled token successfully', {
    orderId: updatedOrder.id,
    orderNumber: updatedOrder.order_number,
    receiptClaimToken: updatedOrder.receipt_claim_token,
  });
  return updatedOrder;
}

function mapEmbeddedOrder(row: OrderWithEmbeddedItemsRow): Order {
  const items: OrderItem[] =
    (row.order_items || []).map((item) => ({
      ...item,
      base_price: Number(item.base_price),
      override_price: item.override_price == null ? null : Number(item.override_price),
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
  until?: string;
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

    if (filters?.since && filters?.until) {
      query = query
        .gte('created_at', filters.since)
        .lte('created_at', filters.until);
    } else if (filters?.since) {
      query = query.gte('created_at', filters.since);
    } else if (filters?.until) {
      query = query.lte('created_at', filters.until);
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

    const mappedOrder = mapEmbeddedOrder(data as unknown as OrderWithEmbeddedItemsRow);
    const hydratedOrder = await ensureReceiptClaimTokenForOrder(mappedOrder);
    return { data: hydratedOrder, error: null };
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

    if (data && status === 'completed' && data.payment_status === 'paid') {
      const rewardResult = await ensureRewardPointsForOrder(orderId);
      if (!rewardResult.success) {
        console.error('Failed to ensure reward points on POS completion:', rewardResult.error);
      }
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

export async function updatePendingDeliveryOrder(
  orderId: string,
  input: {
    address: DeliveryAddressDraft;
    quote: DeliveryQuoteResult;
    deliveryFee: number;
    serviceFee: number;
    totalAmount: number;
  }
): Promise<{ data: Order | null; error: string | null }> {
  try {
    const updatePayload: any = {
      delivery_fee: input.deliveryFee,
      service_fee: input.serviceFee,
      total: input.totalAmount,
      delivery_address_line1: input.address.address_line1,
      delivery_address_line2: input.address.address_line2 || null,
      delivery_city: input.address.city,
      delivery_state: input.address.state,
      delivery_postcode: input.address.postcode,
      delivery_country: input.address.country || 'AU',
      delivery_latitude: input.address.latitude ?? null,
      delivery_longitude: input.address.longitude ?? null,
      delivery_quote_id: input.quote.quote_id,
      delivery_quote_amount: input.quote.fee,
      delivery_quote_currency: input.quote.currency,
      delivery_partner_name: input.quote.provider_name,
      delivery_quote_expires_at: input.quote.expires_at,
      delivery_eta_minutes: input.quote.estimated_duration_minutes,
      delivery_instructions: input.address.delivery_instructions || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)
      .select('*, order_items(*, order_item_addons(*))')
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    if (!data) {
      return { data: null, error: 'Order not found' };
    }

    return { data: mapEmbeddedOrder(data as unknown as OrderWithEmbeddedItemsRow), error: null };
  } catch (error) {
    console.error('Error updating pending delivery order:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to update pending delivery order',
    };
  }
}

export async function notifyDeliveryReady(orderId: string): Promise<{ success: boolean; trackingUrl?: string | null; error: string | null }> {
  try {
    const base = process.env.EXPO_PUBLIC_SITE_URL;
    if (!base) {
      return { success: false, error: 'EXPO_PUBLIC_SITE_URL is not configured' };
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) {
      return { success: false, error: sessionError?.message || 'Missing authenticated session' };
    }

    const response = await fetch(`${base}/api/delivery/ready`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ orderId }),
    });

    const payload = await response.json().catch(() => null) as
      | { success?: boolean; trackingUrl?: string | null; error?: string }
      | null;

    if (!response.ok || !payload?.success) {
      return {
        success: false,
        error: payload?.error || `Ready sync failed (${response.status})`,
      };
    }

    return { success: true, trackingUrl: payload.trackingUrl ?? null, error: null };
  } catch (error) {
    console.error('Error notifying backend about delivery ready:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to notify backend about delivery ready',
    };
  }
}

export async function refreshDeliveryStatus(orderId: string): Promise<{ data: Order | null; error: string | null; synced?: boolean }> {
  try {
    const base = process.env.EXPO_PUBLIC_SITE_URL;
    if (!base) {
      return { data: null, error: 'EXPO_PUBLIC_SITE_URL is not configured' };
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) {
      return { data: null, error: sessionError?.message || 'Missing authenticated session' };
    }

    const response = await fetch(`${base}/api/delivery/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ orderId }),
    });

    const payload = await response.json().catch(() => null) as
      | { success?: boolean; synced?: boolean; error?: string }
      | null;

    if (!response.ok || !payload?.success) {
      return {
        data: null,
        error: payload?.error || `Delivery refresh failed (${response.status})`,
      };
    }

    const latestOrder = await getOrder(orderId);
    return {
      data: latestOrder.data,
      error: latestOrder.error,
      synced: Boolean(payload?.synced),
    };
  } catch (error) {
    console.error('Error refreshing delivery status:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to refresh delivery status',
    };
  }
}

export async function claimOrderForAutoPrint(
  orderId: string,
  deviceId: string,
  staleAfterSeconds = 15
): Promise<{ claimed: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('claim_kitchen_print', {
      p_order_id: orderId,
      p_device_id: deviceId,
      p_stale_after_seconds: staleAfterSeconds,
    });

    if (error) {
      return { claimed: false, error: error.message };
    }

    return { claimed: Boolean(data), error: null };
  } catch (error) {
    console.error('Error claiming order for kitchen print:', error);
    return {
      claimed: false,
      error: error instanceof Error ? error.message : 'Failed to claim order for kitchen print',
    };
  }
}

export async function completeKitchenPrintClaim(
  orderId: string,
  deviceId: string
): Promise<{ completed: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('complete_kitchen_print', {
      p_order_id: orderId,
      p_device_id: deviceId,
    });

    if (error) {
      return { completed: false, error: error.message };
    }

    return { completed: Boolean(data), error: null };
  } catch (error) {
    console.error('Error completing kitchen print claim:', error);
    return {
      completed: false,
      error: error instanceof Error ? error.message : 'Failed to complete kitchen print claim',
    };
  }
}

export async function releaseKitchenPrintClaim(
  orderId: string,
  deviceId: string
): Promise<{ released: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('release_kitchen_print_claim', {
      p_order_id: orderId,
      p_device_id: deviceId,
    });

    if (error) {
      return { released: false, error: error.message };
    }

    return { released: Boolean(data), error: null };
  } catch (error) {
    console.error('Error releasing kitchen print claim:', error);
    return {
      released: false,
      error: error instanceof Error ? error.message : 'Failed to release kitchen print claim',
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
    const receiptClaimToken =
      shouldGenerateReceiptClaimToken(normalizedOrderPayload)
        ? generateReceiptClaimToken()
        : normalizedOrderPayload.receipt_claim_token ?? null;
    console.log('[savePosOrder] receipt claim decision', {
      orderChannel: normalizedOrderPayload.order_channel,
      customerName: normalizedOrderPayload.customer_name,
      userId: normalizedOrderPayload.user_id,
      existingReceiptClaimToken: normalizedOrderPayload.receipt_claim_token ?? null,
      generatedReceiptClaimToken: receiptClaimToken,
    });
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        ...normalizedOrderPayload,
        receipt_claim_token: receiptClaimToken,
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
          override_price: itemData.override_price ?? null,
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
          section: addon.section ?? null,
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
    | 'promotion_discount'
    | 'promotions_applied'
    | 'coupon_code'
    | 'coupon_discount'
    | 'reward_points_used'
    | 'reward_points_value'
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
          override_price: itemData.override_price ?? null,
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
          section: addon.section ?? null,
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
