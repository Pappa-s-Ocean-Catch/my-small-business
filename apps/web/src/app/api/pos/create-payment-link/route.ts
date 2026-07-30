import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { sendSmsMessage } from '@/lib/sms';
import { createPaymentLinkAlias } from '@/lib/payment-link-alias';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export async function POST(request: Request) {
  try {
    if (!stripe) return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });

    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { orderId?: string };
    if (!body.orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });

    const supabase = await createServiceRoleClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(authorization.slice(7));
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_slug')
      .eq('id', user.id)
      .single();
    if (profileError || !profile || !['admin', 'staff'].includes(profile.role_slug)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', body.orderId)
      .single();
    if (orderError || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.payment_status === 'paid' || ['cancelled', 'completed'].includes(order.order_status)) {
      return NextResponse.json({ error: 'This order cannot receive a payment link.' }, { status: 409 });
    }
    if (!order.user_id || !order.customer_phone) {
      return NextResponse.json({ error: 'A linked customer with a phone number is required.' }, { status: 422 });
    }

    const amount = Math.round(Number(order.total) * 100);
    if (!Number.isFinite(amount) || amount < 50) {
      return NextResponse.json({ error: 'Order total must be at least $0.50.' }, { status: 422 });
    }
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pappasoceancatch.com.au';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'aud',
          product_data: { name: `Pappas order #${order.order_number}` },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      success_url: `${baseUrl}/order/confirmation?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
      cancel_url: `${baseUrl}/order/checkout?canceled=true&order_id=${order.id}`,
      metadata: { order_id: order.id, total: Number(order.total).toFixed(2) },
      payment_intent_data: { metadata: { order_id: order.id } },
    });
    if (!session.url) throw new Error('Stripe did not return a checkout URL.');

    const { error: updateError } = await supabase.from('orders').update({
      payment_method: 'online',
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    if (updateError) throw new Error(updateError.message);

    const alias = await createPaymentLinkAlias(order.id, session.url);
    await sendSmsMessage({
      phone: order.customer_phone,
      message: `Hi ${order.customer_name || 'there'}, please pay your Pappas order ($${Number(order.total).toFixed(2)}): ${alias.paymentUrl}`,
      customRef: `pos-pay-by-link-${order.id}`,
    });

    return NextResponse.json({ success: true, sessionId: session.id, paymentUrl: alias.paymentUrl });
  } catch (error) {
    console.error('[POS Pay by Link] Failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create payment link' }, { status: 500 });
  }
}
