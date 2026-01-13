import { NextRequest, NextResponse } from 'next/server';
import { sendMagicLinkInvite } from '@/app/actions/email';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }
    const result = await sendMagicLinkInvite(email);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to send' }, { status: 500 });
    }
    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}


