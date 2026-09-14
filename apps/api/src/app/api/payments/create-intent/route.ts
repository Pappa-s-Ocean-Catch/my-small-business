'use server';

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  // eslint-disable-next-line no-console
  console.warn('[Stripe] Missing STRIPE_SECRET_KEY environment variable. Payment intent creation will fail.');
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

// Stripe fees (Australia): 1.75% + 30c for domestic cards.
// Adjust if needed via env variables.
const STRIPE_PERCENT_FEE = Number(process.env.STRIPE_PERCENT_FEE ?? '0.0175');
const STRIPE_FIXED_FEE = Number(process.env.STRIPE_FIXED_FEE ?? '0.3');

interface CreateIntentBody {
  subtotal: number;
  tax: number;
  deliveryFee: number;
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

    const body = (await request.json()) as CreateIntentBody;
    const currency = (body.currency || 'aud').toLowerCase();

    const subtotal = Number(body.subtotal || 0);
    const tax = Number(body.tax || 0);
    const deliveryFee = Number(body.deliveryFee || 0);

    if (subtotal < 0 || tax < 0 || deliveryFee < 0) {
      return NextResponse.json({ error: 'Invalid amounts' }, { status: 400 });
    }

    const baseAmount = subtotal + tax + deliveryFee;
    const serviceFee = baseAmount * STRIPE_PERCENT_FEE + STRIPE_FIXED_FEE;
    const totalAmount = baseAmount + serviceFee;

    const amountInCents = Math.round(totalAmount * 100);

    // Ensure minimum amount (Stripe requires at least $0.50 AUD = 50 cents)
    if (amountInCents < 50) {
      return NextResponse.json({ 
        error: `Minimum order amount is $0.50 AUD. Current total: $${totalAmount.toFixed(2)}` 
      }, { status: 400 });
    }

    const intent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      // Explicitly allow card (enables Apple/Google Pay via cards)
      payment_method_types: ['card'],
      metadata: {
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        serviceFee: serviceFee.toFixed(2),
      },
    });

    console.log('[Stripe] Payment intent created:', {
      intentId: intent.id,
      amount: amountInCents,
      currency,
      clientSecretPrefix: intent.client_secret?.substring(0, 20) + '...'
    });

    return NextResponse.json({
      clientSecret: intent.client_secret,
      serviceFee,
      currency,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Stripe] Error creating payment intent:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create payment intent';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
