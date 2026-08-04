import { NextResponse } from 'next/server';
import type { Order } from '@my-small-business/types';
import { sendOrderCompletedEmail, sendOrderReadyEmail } from '@/app/actions/email';
import { authenticateStaffApiRequest } from '@/lib/staff-api-auth';
import { isPosStatusEmailStatus } from '@/lib/pos-status-email';

export async function POST(request: Request) {
  try {
    const auth = await authenticateStaffApiRequest(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => null) as { orderId?: string; status?: string } | null;
    const orderId = body?.orderId?.trim();
    const status = body?.status;
    if (!orderId || !isPosStatusEmailStatus(status)) {
      return NextResponse.json({ success: false, error: 'orderId and a ready or completed status are required' }, { status: 400 });
    }

    const { data: order, error } = await auth.supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    if (error || !order) {
      return NextResponse.json({ success: false, error: error?.message || 'Order not found' }, { status: 404 });
    }

    const emailResult = status === 'ready'
      ? await sendOrderReadyEmail(order as Order)
      : await sendOrderCompletedEmail(order as Order);
    if (!emailResult.success) {
      return NextResponse.json({ success: false, error: emailResult.error ?? 'Failed to send order status email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POS status-email] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
