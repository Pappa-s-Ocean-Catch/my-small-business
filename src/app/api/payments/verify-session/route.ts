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

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    console.log('[Stripe] Verifying session:', {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      status: session.status,
      orderId
    });

    // Check if payment was successful
    if (session.payment_status === 'paid' && session.status === 'complete') {
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
