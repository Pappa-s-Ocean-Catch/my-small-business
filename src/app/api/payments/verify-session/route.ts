'use server';

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { updatePaymentStatus, updateOrderStatus } from '@/app/actions/orders';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

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
        .select('id, payment_method, payment_status')
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

      // Award reward points if user is logged in and order is paid
      // Points are earned only on food subtotal, not on fees, tax, or delivery
      if (paymentResult.data?.user_id && paymentResult.data?.payment_status === 'paid') {
        try {
          const { earnRewardPoints } = await import('@/app/actions/reward-points');
          // Use subtotal (food price only) instead of total (which includes fees/tax/delivery)
          const foodSubtotal = parseFloat(paymentResult.data.subtotal.toString());
          const pointsResult = await earnRewardPoints(
            paymentResult.data.user_id,
            orderId,
            foodSubtotal
          );

          if (pointsResult.success) {
            console.log('[Stripe Verify] Reward points awarded:', {
              userId: paymentResult.data.user_id,
              orderId,
              foodSubtotal,
              pointsEarned: pointsResult.pointsEarned,
            });
          } else {
            console.error('[Stripe Verify] Failed to award reward points:', pointsResult.error);
          }
        } catch (error) {
          console.error('[Stripe Verify] Error awarding reward points:', error);
          // Don't fail the verification if points fail
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
