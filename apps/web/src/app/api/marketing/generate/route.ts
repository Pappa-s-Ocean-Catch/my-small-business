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

    const result = await generateMarketingEmail({
      discountPercentage,
      storeName,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { subject: result.subject, htmlBody: result.htmlBody },
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
