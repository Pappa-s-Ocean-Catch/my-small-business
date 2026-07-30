import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params;
  const token = rawToken.toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(token)) {
    return new NextResponse('Payment link unavailable.', { status: 404 });
  }

  const supabase = await createServiceRoleClient();
  const { data: link } = await supabase
    .from('payment_links')
    .select('stripe_checkout_url, expires_at')
    .eq('token', token)
    .single();

  if (!link || new Date(link.expires_at).getTime() <= Date.now()) {
    return new NextResponse('This payment link has expired or is unavailable.', { status: 410 });
  }

  return NextResponse.redirect(link.stripe_checkout_url, 307);
}
