'use server';

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  // eslint-disable-next-line no-console
  console.warn('[Stripe] Missing STRIPE_SECRET_KEY environment variable. Checkout session creation will fail.');
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

// Stripe fees (Australia): 1.75% + 30c for domestic cards.
// Adjust if needed via env variables.
const STRIPE_PERCENT_FEE = Number(process.env.STRIPE_PERCENT_FEE ?? '0.0175');
const STRIPE_FIXED_FEE = Number(process.env.STRIPE_FIXED_FEE ?? '0.3');

interface CreateCheckoutSessionBody {
  orderId: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  items: Array<{
    name: string;
    description?: string;
    quantity: number;
    price: number; // Price per unit in dollars
  }>;
  subtotal: number;
  promotionDiscount?: number;
  tax: number;
  deliveryFee: number;
  rewardPointsDiscount?: number;
  currency?: string;
}

export async function POST(request: Request) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
    }

    // Validate Stripe key format
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

    // Check if keys are from the same account (both test or both live)
    const secretIsTest = stripeSecretKey.startsWith('sk_test_');
    const publishableIsTest = publishableKey.startsWith('pk_test_');

    if (secretIsTest !== publishableIsTest) {
      console.error('[Stripe] Key mismatch detected:', {
        secretKeyType: secretIsTest ? 'test' : 'live',
        publishableKeyType: publishableIsTest ? 'test' : 'live',
        secretKeyPrefix: stripeSecretKey.substring(0, 7),
        publishableKeyPrefix: publishableKey.substring(0, 7)
      });
      return NextResponse.json({
        error: 'Stripe key mismatch: Secret key and publishable key must be from the same account (both test or both live)'
      }, { status: 500 });
    }

    const body = (await request.json()) as CreateCheckoutSessionBody;
    const currency = (body.currency || 'aud').toLowerCase();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://localhost:3000';

    // Calculate service fee (on amount after discounts)
    const rewardPointsDiscount = body.rewardPointsDiscount || 0;
    const baseAmount = Math.max(0, body.subtotal + body.tax + body.deliveryFee - rewardPointsDiscount);
    const serviceFee = baseAmount * STRIPE_PERCENT_FEE + STRIPE_FIXED_FEE;
    const totalAmount = baseAmount + serviceFee;

    // Ensure minimum amount (Stripe requires at least $0.50 AUD = 50 cents)
    const amountInCents = Math.round(totalAmount * 100);
    if (amountInCents < 50) {
      return NextResponse.json({
        error: `Minimum order amount is $0.50 AUD. Current total: $${totalAmount.toFixed(2)}`
      }, { status: 400 });
    }

    // Build line items for Stripe Checkout
    // Note: Promotions/reward points can change the payable amount while keeping item prices unchanged.
    // To avoid mismatched totals, we charge a single "Order" line item and keep the breakdown in metadata.
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency,
          product_data: {
            name: 'Order',
            description: 'Food, tax, and delivery (after discounts)',
          },
          unit_amount: Math.round(baseAmount * 100),
        },
        quantity: 1,
      },
    ];

    // Add service fee as a separate line item
    if (serviceFee > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: {
            name: 'Service Fee',
            description: 'Payment processing fee',
          },
          unit_amount: Math.round(serviceFee * 100),
        },
        quantity: 1,
      });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${baseUrl}/order/confirmation?session_id={CHECKOUT_SESSION_ID}&order_id=${body.orderId}`,
      cancel_url: `${baseUrl}/order/checkout?canceled=true`,
      customer_email: body.customerEmail,
      metadata: {
        order_id: body.orderId,
        customer_name: body.customerName || '',
        customer_phone: body.customerPhone || '',
        subtotal: body.subtotal.toFixed(2),
        promotion_discount: (body.promotionDiscount || 0).toFixed(2),
        tax: body.tax.toFixed(2),
        delivery_fee: body.deliveryFee.toFixed(2),
        service_fee: serviceFee.toFixed(2),
        total: totalAmount.toFixed(2),
      },
      billing_address_collection: 'auto', // 'auto' = optional (shown but not required), 'required' = forced
      phone_number_collection: {
        enabled: true,
      },
    });

    console.log('[Stripe] Checkout session created:', {
      sessionId: session.id,
      orderId: body.orderId,
      amount: amountInCents,
      currency,
      url: session.url?.substring(0, 50) + '...'
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      serviceFee,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Stripe] Error creating checkout session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
