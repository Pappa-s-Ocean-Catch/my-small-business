import { NextResponse } from 'next/server';
import { generateMarketingEmail } from '@/lib/google-genai';

export async function POST(request: Request) {
  try {
    const {
      discountPercentage,
    }: {
      discountPercentage: number;
    } = await request.json();

    const storeName = process.env.NEXT_PUBLIC_STORE_NAME || 'Our Store';
    const storePhone = process.env.NEXT_PUBLIC_STORE_PHONE || process.env.STORE_PHONE || '(03) 9743 8150';
    const storeAddress =
      process.env.NEXT_PUBLIC_STORE_ADDRESS
      || process.env.NEXT_PUBLIC_STORE_ADDRESS_LINE1
      || process.env.STORE_ADDRESS_LINE1
      || 'Shop 2/87 Unitt Street, Melton VIC 3337';

    const result = await generateMarketingEmail({
      discountPercentage,
      storeName,
      storePhone,
      storeAddress,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { subject: result.subject, htmlBody: result.htmlBody, smsBody: result.smsBody },
      { status: 200 }
    );
  } catch (err) {
    console.error('Error in /api/marketing/generate POST handler:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 400 }
    );
  }
}
