'use server';

import { getShipdayClient } from '@my-small-business/shipday';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import type { Order } from '@my-small-business/types';

export async function createShipdayOrder(orderId: string) {
  try {
    console.log(`[Shipday Action] Starting order creation for Order ID: ${orderId}`);
    const supabase = await createServiceRoleClient();

    
    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error(`[Shipday Action] Order fetch error for ${orderId}:`, orderError);
      throw new Error(orderError?.message || 'Order not found');
    }

    console.log(`[Shipday Action] Order found: ${order.order_number}, Type: ${order.order_type}`);

    if (order.order_type !== 'delivery') {
      console.log(`[Shipday Action] Skipping non-delivery order: ${orderId}`);
      return { success: false, error: 'Not a delivery order' };
    }

    const client = getShipdayClient();
    
    // Construct full address string
    const addressString = [
      order.delivery_address_line1,
      order.delivery_address_line2,
      order.delivery_city,
      order.delivery_state,
      order.delivery_postcode,
      order.delivery_country || 'AU'
    ].filter(Boolean).join(', ');

    console.log(`[Shipday Action] Constructed Address: ${addressString}`);

    const createdAt = order.created_at || new Date().toISOString();
    const expectedPickupAt = new Date(new Date(createdAt).getTime() + 10 * 60 * 1000);
    const etaMinutes = Number(order.delivery_eta_minutes) > 0 ? Number(order.delivery_eta_minutes) : 30;
    const expectedDeliveryAt = new Date(expectedPickupAt.getTime() + etaMinutes * 60 * 1000);

    const paymentMethod: 'online' | 'store' =
      order.payment_method === 'store' ? 'store' : 'online';

    const shipdayPayload = {
      external_order_id: order.order_number,
      customer_name: order.customer_name || 'Customer',
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      delivery_address: addressString,
      pickup_address: [
        process.env.STORE_ADDRESS_LINE1 || process.env.NEXT_PUBLIC_STORE_ADDRESS_LINE1 || '2/87 Unitt Street',
        process.env.STORE_ADDRESS_LINE2 || process.env.NEXT_PUBLIC_STORE_ADDRESS_LINE2 || null,
        process.env.STORE_CITY || process.env.NEXT_PUBLIC_STORE_CITY || 'Melton',
        process.env.STORE_STATE || process.env.NEXT_PUBLIC_STORE_STATE || 'VIC',
        process.env.STORE_POSTCODE || process.env.NEXT_PUBLIC_STORE_POSTCODE || '3337',
        process.env.STORE_COUNTRY || 'AU',
      ].filter(Boolean).join(', '),
      pickup_latitude: process.env.STORE_LATITUDE ? Number(process.env.STORE_LATITUDE) : null,
      pickup_longitude: process.env.STORE_LONGITUDE ? Number(process.env.STORE_LONGITUDE) : null,
      delivery_latitude: order.delivery_latitude ?? null,
      delivery_longitude: order.delivery_longitude ?? null,
      subtotal: Number(order.subtotal) || 0,
      tax: Number(order.tax) || 0,
      delivery_fee: order.delivery_fee,
      total_amount: order.total,
      discount_amount:
        (Number(order.promotion_discount) || 0) +
        (Number(order.coupon_discount) || 0) +
        (Number(order.reward_points_value) || 0),
      payment_method: paymentMethod,
      placed_at: createdAt,
      expected_pickup_at: expectedPickupAt.toISOString(),
      expected_delivery_at: expectedDeliveryAt.toISOString(),
      items: order.order_items.map((item: any) => ({
        name: item.product_name,
        quantity: item.quantity,
        unit_price: Number(item.quantity) > 0
          ? Number((Number(item.subtotal || 0) / Number(item.quantity)).toFixed(2))
          : Number(item.base_price),
      })),
      special_instructions: [
        order.special_instructions,
        order.delivery_instructions ? `Delivery Instructions: ${order.delivery_instructions}` : null
      ].filter(Boolean).join('\n'),
      // Dev mode: if SHIPDAY_TEST_MODE is true, we might want to flag it or handle it in the client
      assign_driver: process.env.SHIPDAY_TEST_MODE !== 'true'
    };

    console.log('[Shipday Action] Sending payload to Shipday:', JSON.stringify(shipdayPayload, null, 2));

    const res = await client.createDelivery(shipdayPayload);

    console.log(`[Shipday Action] Shipday Response:`, JSON.stringify(res, null, 2));

    // Update internal order with Shipday info
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        delivery_provider_id: res.delivery_id,
        delivery_status: 'pending',
        delivery_tracking_url: res.tracking_url || null,
      })
      .eq('id', orderId);

    if (updateError) {
      console.error(`[Shipday Action] Failed to update order ${orderId} with Shipday info:`, updateError);
    }

    return { success: true, deliveryId: res.delivery_id };
  } catch (error) {
    console.error('[Shipday Action] Fatal Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create Shipday order' };
  }

}

export async function markShipdayOrderReady(orderId: string) {
  try {
    console.log(`[Shipday Action] Marking order ready for Shipday. Order ID: ${orderId}`);
    const supabase = await createServiceRoleClient();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*, order_item_addons(*))')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error(`[Shipday Action] Failed to load order ${orderId} for ready sync:`, orderError);
      return { success: false, error: orderError?.message || 'Order not found' };
    }

    if (order.order_type !== 'delivery') {
      return { success: true, skipped: true };
    }

    if (!order.delivery_provider_id) {
      return { success: false, error: 'Delivery provider id missing' };
    }

    const client = getShipdayClient();
    const addressString = [
      order.delivery_address_line1,
      order.delivery_address_line2,
      order.delivery_city,
      order.delivery_state,
      order.delivery_postcode,
      order.delivery_country || 'AU'
    ].filter(Boolean).join(', ');

    const pickupAddress = [
      process.env.STORE_ADDRESS_LINE1 || process.env.NEXT_PUBLIC_STORE_ADDRESS_LINE1 || '2/87 Unitt Street',
      process.env.STORE_ADDRESS_LINE2 || process.env.NEXT_PUBLIC_STORE_ADDRESS_LINE2 || null,
      process.env.STORE_CITY || process.env.NEXT_PUBLIC_STORE_CITY || 'Melton',
      process.env.STORE_STATE || process.env.NEXT_PUBLIC_STORE_STATE || 'VIC',
      process.env.STORE_POSTCODE || process.env.NEXT_PUBLIC_STORE_POSTCODE || '3337',
      process.env.STORE_COUNTRY || 'AU',
    ].filter(Boolean).join(', ');

    const res = await client.markDeliveryReady({
      delivery_id: String(order.delivery_provider_id),
    });

    await supabase.from('order_events').insert({
      order_id: order.id,
      source: 'shipday',
      event_type: 'mark_ready',
      status: order.delivery_status || 'pending',
      message: 'Marked ready for pickup from POS',
      external_order_number: order.order_number,
      external_delivery_id: String(order.delivery_provider_id),
      details: res.raw || { delivery_id: res.delivery_id, tracking_url: res.tracking_url || null },
    });

    if (res.tracking_url) {
      await supabase
        .from('orders')
        .update({ delivery_tracking_url: res.tracking_url })
        .eq('id', order.id);
    }

    return { success: true, deliveryId: res.delivery_id, trackingUrl: res.tracking_url || null };
  } catch (error) {
    console.error('[Shipday Action] Fatal ready-sync error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to mark Shipday order ready' };
  }
}

function mapShipdayStatus(rawStatus: string | null | undefined): string {
  const status = (rawStatus || '').toLowerCase();

  if (!status.trim()) return 'pending';
  if (status.includes('deliver')) return 'delivered';
  if (
    status.includes('picked_up') ||
    status.includes('picked up') ||
    status.includes('pickup complete') ||
    status.includes('in_transit') ||
    status.includes('in transit') ||
    status.includes('picked') ||
    status.includes('transit') ||
    status.includes('inflight') ||
    status.includes('enroute') ||
    status.includes('on_the_way') ||
    status.includes('on the way')
  ) {
    return 'inflight';
  }
  if (
    status.includes('assign') ||
    status.includes('accept') ||
    status.includes('driver') ||
    status.includes('dispatch') ||
    status.includes('scheduled')
  ) {
    return 'assigned';
  }
  if (status.includes('cancel')) return 'cancelled';
  if (status.includes('fail')) return 'failed';
  return 'pending';
}

export async function refreshShipdayOrderStatus(orderId: string) {
  try {
    const supabase = await createServiceRoleClient();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return { success: false, error: orderError?.message || 'Order not found' };
    }

    if (order.order_type !== 'delivery') {
      return { success: true, skipped: true, reason: 'Not a delivery order' };
    }

    if (!order.delivery_provider_id) {
      return { success: true, skipped: true, reason: 'Delivery provider id missing' };
    }

    const client = getShipdayClient();
    const res = await client.getDeliveryStatus(String(order.delivery_provider_id));
    const normalizedStatus = mapShipdayStatus(res.status);

    const updatePayload: Record<string, string | null> = {
      delivery_status: normalizedStatus,
      delivery_tracking_url: res.tracking_url || order.delivery_tracking_url || null,
      delivery_driver_name: res.driver_name || null,
      delivery_driver_phone: res.driver_phone || null,
      delivery_driver_pin: res.driver_pin || null,
      delivery_vehicle_info: res.vehicle_info || null,
    };

    const outOfSync =
      order.delivery_status !== updatePayload.delivery_status ||
      (order.delivery_tracking_url || null) !== updatePayload.delivery_tracking_url ||
      (order.delivery_driver_name || null) !== updatePayload.delivery_driver_name ||
      (order.delivery_driver_phone || null) !== updatePayload.delivery_driver_phone ||
      (order.delivery_driver_pin || null) !== updatePayload.delivery_driver_pin ||
      (order.delivery_vehicle_info || null) !== updatePayload.delivery_vehicle_info;

    if (outOfSync) {
      const { error: updateError } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', order.id);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    }

    await supabase.from('order_events').insert({
      order_id: order.id,
      source: 'shipday',
      event_type: 'status_refresh',
      status: normalizedStatus,
      message: outOfSync ? 'Delivery status refreshed from Shipday and local order updated' : 'Delivery status refreshed from Shipday',
      external_order_number: order.order_number,
      external_delivery_id: String(order.delivery_provider_id),
      details: res.raw || {
        delivery_id: res.delivery_id,
        tracking_url: res.tracking_url || null,
        status: res.status,
      },
    });

    const { data: updatedOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order.id)
      .single();

    return {
      success: true,
      synced: outOfSync,
      status: normalizedStatus,
      trackingUrl: updatePayload.delivery_tracking_url,
      order: updatedOrder || order,
    };
  } catch (error) {
    console.error('[Shipday Action] Fatal refresh-status error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to refresh Shipday delivery status' };
  }
}
