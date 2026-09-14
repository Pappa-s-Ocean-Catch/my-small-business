import { NextResponse } from 'next/server';
import { sendSmsMessage } from '@/lib/sms';
import { authenticateStaffApiRequest } from '@/lib/staff-api-auth';

type Body = {
  phone?: string;
  customerName?: string;
  paymentUrl?: string;
  orderId?: string;
  deliveryAddress?: string;
  totalAmount?: number;
  deliveryFee?: number;
  deliveryEtaMinutes?: number;
};

const formatCurrency = (amount?: number) => (
  typeof amount === 'number' && Number.isFinite(amount) ? `$${amount.toFixed(2)}` : null
);

export async function POST(request: Request) {
  try {
    const auth = await authenticateStaffApiRequest(request);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as Body;
    const phone = body.phone?.trim() || '';
    const paymentUrl = body.paymentUrl?.trim() || '';
    const customerName = body.customerName?.trim() || 'there';
    const deliveryAddress = body.deliveryAddress?.trim() || '';
    const totalAmount = formatCurrency(body.totalAmount);
    const deliveryFee = formatCurrency(body.deliveryFee);
    const etaMinutes = typeof body.deliveryEtaMinutes === 'number' && body.deliveryEtaMinutes > 0
      ? Math.round(body.deliveryEtaMinutes)
      : null;

    if (!phone || !paymentUrl) {
      return NextResponse.json({ success: false, error: 'phone and paymentUrl are required' }, { status: 400 });
    }

    const details = [
      deliveryAddress ? `Delivery to: ${deliveryAddress}.` : null,
      totalAmount ? `Total: ${totalAmount}.` : null,
      deliveryFee ? `Delivery: ${deliveryFee}.` : null,
      etaMinutes ? `ETA about ${etaMinutes} min, likely sooner.` : null,
    ].filter(Boolean);

    const message = [
      `Hi ${customerName}, please complete your Pappas delivery payment here: ${paymentUrl}`,
      details.join(' '),
    ].filter(Boolean).join(' ');
    const smsResult = await sendSmsMessage({
      phone,
      message,
      customRef: body.orderId ? `pos-delivery-${body.orderId}` : 'pos-delivery-payment',
    });

    return NextResponse.json({
      success: true,
      provider: smsResult.provider,
      result: smsResult.result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to send payment link SMS' },
      { status: 500 }
    );
  }
}
