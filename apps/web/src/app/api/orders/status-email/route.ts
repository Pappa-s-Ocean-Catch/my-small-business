'use server';

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import type { Order } from '@my-small-business/types';
import { sendOrderPlacedEmail, sendOrderReadyEmail, sendOrderCompletedEmail } from '@/app/actions/email';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null) as { orderId?: string, status?: string } | null;
        const orderId = body?.orderId;
        const status = body?.status;

        if (!orderId || !status) {
            return NextResponse.json({ success: false, error: 'orderId and status are required' }, { status: 400 });
        }

        const supabase = await createServiceRoleClient();
        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (error || !order) {
            console.error('[status-email] Failed to load order:', error);
            return NextResponse.json(
                { success: false, error: error?.message || 'Order not found' },
                { status: 404 },
            );
        }

        let emailResult;
        if (status === 'ready') {
            emailResult = await sendOrderReadyEmail(order as Order);
        } else if (status === 'completed') {
            emailResult = await sendOrderCompletedEmail(order as Order);
        } else if (status === 'placed') {
            emailResult = await sendOrderPlacedEmail(order as Order);
        } else {
            return NextResponse.json({ success: false, error: 'Unsupported status for email' }, { status: 400 });
        }

        if (!emailResult.success) {
            return NextResponse.json(
                { success: false, error: emailResult.error ?? 'Failed to send order status email' },
                { status: 500 },
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[status-email] Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
            { status: 500 },
        );
    }
}
