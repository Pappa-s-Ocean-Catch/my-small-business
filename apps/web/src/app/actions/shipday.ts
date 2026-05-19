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

    const shipdayPayload = {
      external_order_id: order.order_number,
      customer_name: order.customer_name || 'Customer',
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      delivery_address: addressString,
      delivery_fee: order.delivery_fee,
      total_amount: order.total,
      items: order.order_items.map((item: any) => ({
        name: item.product_name,
        quantity: item.quantity,
        unit_price: Number(item.base_price)
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
        delivery_quote_id: res.delivery_id, // Store Shipday delivery ID here
        delivery_status: 'delivery_created' // Shipday status equivalent
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
