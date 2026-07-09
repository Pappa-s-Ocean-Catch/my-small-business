import { NextResponse } from 'next/server';
import { sendSmsMessage } from '@/lib/sms';

type Body = {
  phone?: string;
  customerName?: string;
  paymentUrl?: string;
  orderId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const phone = body.phone?.trim() || '';
    const paymentUrl = body.paymentUrl?.trim() || '';
    const customerName = body.customerName?.trim() || 'there';

    if (!phone || !paymentUrl) {
      return NextResponse.json({ success: false, error: 'phone and paymentUrl are required' }, { status: 400 });
    }

    const message = `Hi ${customerName}, please complete your Pappas delivery payment here: ${paymentUrl}`;
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
