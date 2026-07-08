import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { updatePaymentStatus, updateOrderStatus } from '@/app/actions/orders';
import { ensureOrderRewardPoints } from '@/app/actions/reward-points';
import { getShipdayClient } from '@my-small-business/shipday';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

function buildShipdayItemDetail(item: any): string | undefined {
  const parts: string[] = [];
  if (item.comment) {
    parts.push(`Comment: ${item.comment}`);
  }
  if (Array.isArray(item.removed_ingredients) && item.removed_ingredients.length > 0) {
    parts.push(`Remove: ${item.removed_ingredients.join(', ')}`);
  }
  return parts.length > 0 ? parts.join(' | ') : undefined;
}

export async function POST(request: Request) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
    }

    const body = (await request.json()) as { sessionId: string; orderId: string };
    const { sessionId, orderId } = body;

    if (!sessionId || !orderId) {
      return NextResponse.json({ error: 'sessionId and orderId are required' }, { status: 400 });
    }

    // SECURITY: Validate sessionId format (Stripe session IDs start with cs_)
    if (!sessionId.startsWith('cs_')) {
      console.error('[Stripe] Invalid session ID format:', sessionId);
      return NextResponse.json({ error: 'Invalid session ID format' }, { status: 400 });
    }

    // SECURITY: Validate orderId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orderId)) {
      console.error('[Stripe] Invalid order ID format:', orderId);
      return NextResponse.json({ error: 'Invalid order ID format' }, { status: 400 });
    }

    // SECURITY: Retrieve the checkout session from Stripe (validates session exists)
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      console.error('[Stripe] Error retrieving session:', error);
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 400 });
    }

    // CRITICAL SECURITY: Verify that the session metadata matches the provided orderId
    // This prevents attackers from using a valid sessionId with a different orderId
    const sessionOrderId = session.metadata?.order_id;
    if (!sessionOrderId || sessionOrderId !== orderId) {
      console.error('[Stripe] Session order ID mismatch:', {
        providedOrderId: orderId,
        sessionOrderId: sessionOrderId || 'missing',
        sessionId: session.id
      });
      return NextResponse.json({
        error: 'Session does not match the provided order'
      }, { status: 403 });
    }

    console.log('[Stripe] Verifying session:', {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      status: session.status,
      orderId,
      sessionOrderId: session.metadata?.order_id
    });

    // Check if payment was successful
    if (session.payment_status === 'paid' && session.status === 'complete') {
      // SECURITY: Verify the order exists and payment method is 'online' before updating
      const supabase = await createServiceRoleClient();
      const { data: existingOrder, error: orderError } = await supabase
        .from('orders')
        .select('id, payment_method, payment_status, delivery_provider_id, delivery_status')
        .eq('id', orderId)
        .single();

      if (orderError || !existingOrder) {
        console.error('[Stripe] Order not found or error:', orderError);
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      // SECURITY: Only allow updating payment status for online payment methods
      if (existingOrder.payment_method !== 'online') {
        console.error('[Stripe] Invalid payment method for this update:', existingOrder.payment_method);
        return NextResponse.json({
          error: 'Payment status can only be updated for online payments'
        }, { status: 400 });
      }

      // SECURITY: Prevent duplicate updates if already paid (idempotency)
      if (existingOrder.payment_status === 'paid') {
        const ensureResult = await ensureOrderRewardPoints(orderId);
        if (!ensureResult.success) {
          console.error('[Stripe] Failed to ensure reward points for already-paid order:', ensureResult.error);
        }
        console.log('[Stripe] Order already marked as paid, skipping update');
        return NextResponse.json({
          success: true,
          paymentStatus: 'paid',
          orderStatus: 'confirmed',
          message: 'Order already marked as paid'
        });
      }

      // Update order payment status to 'paid'
      const paymentResult = await updatePaymentStatus(orderId, 'paid');
      if (paymentResult.error) {
        console.error('[Stripe] Error updating payment status:', paymentResult.error);
        return NextResponse.json({
          error: 'Failed to update payment status',
          details: paymentResult.error
        }, { status: 500 });
      }

      // Update order status to 'confirmed' (not 'pending')
      const orderResult = await updateOrderStatus(orderId, 'confirmed');
      if (orderResult.error) {
        console.error('[Stripe] Error updating order status:', orderResult.error);
        // Payment status update succeeded, so we'll still return success
      }

      // Send order placed email if not already sent
      if (orderResult.data) {
        try {
          const status = orderResult.data.order_status;
          if (status === 'confirmed') {
            console.log('[verify-session] Sending order placed email for order:', orderResult.data.order_number, orderResult.data.customer_email, 'status:', status);
            const { sendOrderPlacedEmail } = await import('@/app/actions/email');
            const emailResult = await sendOrderPlacedEmail(orderResult.data);
            console.log('[verify-session] sendOrderPlacedEmail result:', emailResult);
          } else {
            console.log('[verify-session] Skipping order placed email for order:', orderResult.data.order_number, 'status:', status);
          }
        } catch (emailErr) {
          console.error('[verify-session] Failed to send order placed email:', emailErr);
        }
      }
      // Ensure reward points are allocated once for paid orders.
      const ensureResult = await ensureOrderRewardPoints(orderId);
      if (!ensureResult.success) {
        console.error('[Stripe Verify] Failed to ensure reward points:', ensureResult.error);
      }

      // Automatically create delivery in Shipday for delivery orders (post-payment)
      try {
        if (orderResult.data && orderResult.data.order_type === 'delivery') {
          const shipdayKey = process.env.SHIPDAY_API_KEY;
          if (!shipdayKey) {
            console.log('[Shipday] SHIPDAY_API_KEY not configured — skipping delivery creation');
          } else {
            if (existingOrder.delivery_provider_id) {
              console.log('[Shipday] Delivery already linked for order, skipping duplicate create', {
                orderId,
                deliveryProviderId: existingOrder.delivery_provider_id,
              });
            } else {
              const { data: claimedRows, error: claimError } = await supabase
                .from('orders')
                .update({ delivery_status: 'quote_requested' })
                .eq('id', orderId)
                .is('delivery_provider_id', null)
                .eq('delivery_status', 'pending')
                .select('id');

              if (claimError) {
                console.error('[Shipday] Failed to claim delivery creation lock:', claimError);
              }

              if (!claimedRows || claimedRows.length === 0) {
                console.log('[Shipday] Another request already claimed delivery creation, skipping duplicate create', {
                  orderId,
                  deliveryStatus: existingOrder.delivery_status,
                });
              } else {
                const client = getShipdayClient();

                const pickupAddress = {
                  address_line1: process.env.STORE_ADDRESS_LINE1 || '2/87 Unitt Street',
                  address_line2: process.env.STORE_ADDRESS_LINE2 || null,
                  city: process.env.STORE_CITY || 'Melton',
                  state: process.env.STORE_STATE || 'VIC',
                  postcode: process.env.STORE_POSTCODE || '3337',
                  country: process.env.STORE_COUNTRY || 'AU',
                  latitude: process.env.STORE_LATITUDE ? Number(process.env.STORE_LATITUDE) : null,
                  longitude: process.env.STORE_LONGITUDE ? Number(process.env.STORE_LONGITUDE) : null,
                };

                const dropoffAddress = {
                  address_line1: orderResult.data.delivery_address_line1 || '',
                  address_line2: orderResult.data.delivery_address_line2 || null,
                  city: orderResult.data.delivery_city || '',
                  state: orderResult.data.delivery_state || '',
                  postcode: orderResult.data.delivery_postcode || '',
                  country: orderResult.data.delivery_country || 'AU',
                  latitude: orderResult.data.delivery_latitude ?? null,
                  longitude: orderResult.data.delivery_longitude ?? null,
                };

                const items = (orderResult.data.items || []).map((it: any) => {
                  const quantity = Number(it.quantity) || 1;
                  const subtotal = Number(it.subtotal) || 0;
                  return {
                    name: it.product_name,
                    quantity,
                    unit_price: quantity > 0 ? Number((subtotal / quantity).toFixed(2)) : subtotal,
                    add_ons: Array.isArray(it.addons)
                      ? it.addons.map((addon: any) => `${addon.addon_item_name} (+$${Number(addon.addon_item_price || 0).toFixed(2)})`)
                      : [],
                    detail: buildShipdayItemDetail(it),
                  };
                });

                const assignDriver = !(process.env.SHIPDAY_TEST_MODE === 'true' || process.env.NODE_ENV !== 'production');
                const orderPlacedAt = orderResult.data.created_at || new Date().toISOString();
                const expectedPickupAt = new Date(new Date(orderPlacedAt).getTime() + 10 * 60 * 1000);
                const etaMinutes =
                  Number(orderResult.data.delivery_eta_minutes) > 0
                    ? Number(orderResult.data.delivery_eta_minutes)
                    : 30;
                const expectedDeliveryAt = new Date(expectedPickupAt.getTime() + etaMinutes * 60 * 1000);

                const pickupAddressStr = [
                  pickupAddress.address_line1,
                  pickupAddress.address_line2,
                  pickupAddress.city,
                  pickupAddress.state,
                  pickupAddress.postcode,
                  pickupAddress.country || 'AU'
                ].filter(Boolean).join(', ');

                const dropoffAddressStr = [
                  dropoffAddress.address_line1,
                  dropoffAddress.address_line2,
                  dropoffAddress.city,
                  dropoffAddress.state,
                  dropoffAddress.postcode,
                  dropoffAddress.country || 'AU'
                ].filter(Boolean).join(', ');

                const shipRes = await client.createDelivery({
                  pickup_address: pickupAddressStr,
                  delivery_address: dropoffAddressStr,
                  pickup_latitude: pickupAddress.latitude,
                  pickup_longitude: pickupAddress.longitude,
                  delivery_latitude: dropoffAddress.latitude,
                  delivery_longitude: dropoffAddress.longitude,
                  customer_phone: orderResult.data.customer_phone || '',
                  customer_name: orderResult.data.customer_name || orderResult.data.customer_email || 'Customer',
                  customer_email: orderResult.data.customer_email || '',
                  external_order_id: orderResult.data.order_number || orderId,
                  items,
                  subtotal: Number(orderResult.data.subtotal) || 0,
                  total_amount: Number(orderResult.data.total) || 0,
                  tax: Number(orderResult.data.tax) || 0,
                  delivery_fee: Number(orderResult.data.delivery_fee) || 0,
                  discount_amount:
                    (Number(orderResult.data.promotion_discount) || 0) +
                    (Number(orderResult.data.coupon_discount) || 0) +
                    (Number(orderResult.data.reward_points_value) || 0),
                  payment_method: orderResult.data.payment_method === 'store' ? 'store' : 'online',
                  placed_at: orderPlacedAt,
                  expected_pickup_at: expectedPickupAt.toISOString(),
                  expected_delivery_at: expectedDeliveryAt.toISOString(),
                  special_instructions: [
                    orderResult.data.special_instructions,
                    orderResult.data.delivery_instructions ? `Delivery Instructions: ${orderResult.data.delivery_instructions}` : null
                  ].filter(Boolean).join('\n') || undefined,
                  assign_driver: assignDriver,
                });


                // Persist Shipday response to orders table (best-effort)
                try {
                  const supabase = await createServiceRoleClient();
                  await supabase.from('orders').update({
                    delivery_provider_id: shipRes.delivery_id || null,
                    delivery_status: 'pending',
                    delivery_tracking_url: shipRes.tracking_url || null,
                  }).eq('id', orderId);
                  console.log('[Shipday] Delivery created and saved for order', orderId, shipRes.delivery_id);
                } catch (dbErr) {
                  console.error('[Shipday] Failed to persist delivery info for order', orderId, dbErr);
                }
              }
            }
          }
        }
      } catch (shipErr) {
        console.error('[Shipday] Error while creating delivery for order', orderId, shipErr);
        try {
          await supabase
            .from('orders')
            .update({ delivery_status: 'pending' })
            .eq('id', orderId)
            .eq('delivery_status', 'quote_requested');
        } catch (resetErr) {
          console.error('[Shipday] Failed to reset delivery status after Shipday error', resetErr);
        }
      }

      console.log('[Stripe] Order updated successfully:', {
        orderId,
        paymentStatus: 'paid',
        orderStatus: 'confirmed'
      });

      return NextResponse.json({
        success: true,
        paymentStatus: 'paid',
        orderStatus: 'confirmed',
        order: paymentResult.data
      });
    }

    // Payment not completed yet
    return NextResponse.json({
      success: false,
      paymentStatus: session.payment_status,
      status: session.status,
      message: 'Payment not completed'
    });
  } catch (error) {
    console.error('[Stripe] Error verifying session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to verify session';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
