import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { getPostHogClient } from '@/lib/posthog-server';
import { ensureOrderRewardPoints } from '@/app/actions/reward-points';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  if (!stripe || !webhookSecret) {
    console.error('[Stripe Webhook] Missing Stripe configuration');
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('[Stripe Webhook] Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error');
    console.error('[Stripe Webhook] Signature verification failed:', error.message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${error.message}` },
      { status: 400 }
    );
  }

  console.log('[Stripe Webhook] Received event:', event.type);

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      const supabase = await createServiceRoleClient();
      const orderId = session.metadata?.order_id;

      if (!orderId) {
        console.error('[Stripe Webhook] Missing order_id in session metadata');
        return NextResponse.json(
          { error: 'Missing order_id in metadata' },
          { status: 400 }
        );
      }

      // Update order payment status to 'paid'
      const { data: order, error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          order_status: 'confirmed',
        })
        .eq('id', orderId)
        .select()
        .single();

      if (updateError) {
        console.error('[Stripe Webhook] Error updating order:', updateError);
        return NextResponse.json(
          { error: 'Failed to update order' },
          { status: 500 }
        );
      }

      // Trigger Shipday order creation if it's a delivery order
      console.log(`[Stripe Webhook] Checking if order requires Shipday. Order type: ${order?.order_type}`);
      if (order.order_type === 'delivery') {
        try {
          console.log(`[Stripe Webhook] Order ${order.id} is delivery. Triggering Shipday...`);
          const { createShipdayOrder } = await import('@/app/actions/shipday');

          const shipdayResult = await createShipdayOrder(order.id);
          if (!shipdayResult.success) {
            console.error('[Stripe Webhook] Failed to create Shipday order:', shipdayResult.error);
          } else {
            console.log('[Stripe Webhook] Shipday order created successfully:', shipdayResult.deliveryId);
          }
        } catch (shipdayErr) {
          console.error('[Stripe Webhook] Error calling createShipdayOrder:', shipdayErr);
        }
      }

      const ensureResult = await ensureOrderRewardPoints(order.id);

      if (!ensureResult.success) {
        console.error('[Stripe Webhook] Failed to ensure reward points:', ensureResult.error);
      }

      console.log('[Stripe Webhook] Order updated successfully:', {
        orderId: order.id,
        orderNumber: order.order_number,
        paymentStatus: order.payment_status,
      });

      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: session.customer_email || order.user_id || order.id,
        event: 'payment_completed',
        properties: {
          order_id: order.id,
          order_number: order.order_number,
          total: parseFloat(session.metadata?.total || '0'),
          currency: session.currency || 'aud',
          stripe_session_id: session.id,
        },
      });

      return NextResponse.json({
        success: true,
        orderId: order.id,
        orderNumber: order.order_number,
      });
    } catch (error) {
      console.error('[Stripe Webhook] Error processing checkout.session.completed:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  // Handle payment_intent.succeeded as a fallback
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata?.order_id;
    console.log(`[Stripe Webhook] Handling payment_intent.succeeded. Order ID from metadata: ${orderId}`);

    if (orderId) {
      try {
        const supabase = await createServiceRoleClient();

        const { data: order, error: updateError } = await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            order_status: 'confirmed',
          })
          .eq('id', orderId)
          .select()
          .single();

        if (updateError) {
          console.error('[Stripe Webhook] Error updating order from payment_intent:', updateError);
        } else {
          const ensureResult = await ensureOrderRewardPoints(order.id);
          if (!ensureResult.success) {
            console.error('[Stripe Webhook] Failed to ensure reward points from payment_intent:', ensureResult.error);
          }
          console.log('[Stripe Webhook] Order updated from payment_intent:', {
            orderId: order.id,
            orderNumber: order.order_number,
            orderType: order.order_type
          });

          // Also trigger Shipday if it is delivery here, just in case session completed was missed
          if (order.order_type === 'delivery') {
            try {
              console.log(`[Stripe Webhook] Order ${order.id} is delivery (from payment_intent fallback). Triggering Shipday...`);
              const { createShipdayOrder } = await import('@/app/actions/shipday');
              const shipdayResult = await createShipdayOrder(order.id);
              if (!shipdayResult.success) {
                console.error('[Stripe Webhook] Failed to create Shipday order (fallback):', shipdayResult.error);
              } else {
                console.log('[Stripe Webhook] Shipday order created successfully (fallback):', shipdayResult.deliveryId);
              }
            } catch (shipdayErr) {
              console.error('[Stripe Webhook] Error calling createShipdayOrder (fallback):', shipdayErr);
            }
          }
        }
      } catch (error) {
        console.error('[Stripe Webhook] Error processing payment_intent.succeeded:', error);
      }
    }
  }

  return NextResponse.json({ received: true });
}
