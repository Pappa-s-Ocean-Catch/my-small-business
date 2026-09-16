'use server';

import { NextResponse } from 'next/server';
import { getOrder } from '@/app/actions/orders';
import { sendOrderPlacedEmail } from '@/app/actions/email';
import { isPublicStatusEmailStatus } from '@/lib/pos-status-email';

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null) as { orderId?: string, status?: string } | null;
        const orderId = body?.orderId;
        const status = body?.status;

        if (!orderId || !isPublicStatusEmailStatus(status)) {
            return NextResponse.json({ success: false, error: 'orderId and a placed status are required' }, { status: 400 });
        }

        const orderResult = await getOrder(orderId);

        if (orderResult.error || !orderResult.data) {
            console.error('[status-email] Failed to load order:', orderResult.error);
            return NextResponse.json(
                { success: false, error: orderResult.error || 'Order not found' },
                { status: 404 },
            );
        }

        const emailResult = await sendOrderPlacedEmail(orderResult.data);

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
