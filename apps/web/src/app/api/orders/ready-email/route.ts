'use server';

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import type { Order } from '@my-small-business/types';
import { sendOrderReadyEmail } from '@/app/actions/email';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { orderId?: string } | null;
    const orderId = body?.orderId;

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 });
    }

    const supabase = await createServiceRoleClient();

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      console.error('[ready-email] Failed to load order:', error);
      return NextResponse.json(
        { success: false, error: error?.message || 'Order not found' },
        { status: 404 },
      );
    }

    const { success, error: emailError } = await sendOrderReadyEmail(order as Order);

    if (!success) {
      return NextResponse.json(
        { success: false, error: emailError ?? 'Failed to send order ready email' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ready-email] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}

