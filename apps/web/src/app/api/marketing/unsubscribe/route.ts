import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { id, token } = await request.json();

    if (!id || !token) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const hmacSecret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RESEND_API_KEY || 'default_secret';
    const expectedToken = crypto.createHmac('sha256', hmacSecret).update(id).digest('hex');

    if (token !== expectedToken) {
      return NextResponse.json({ error: 'Invalid or expired unsubscribe link' }, { status: 403 });
    }

    const supabase = await createServiceRoleClient();

    const { error } = await supabase
      .from('profiles')
      .update({ opt_in_marketing: false })
      .eq('id', id);

    if (error) {
      console.error('Error updating unsubscribe status:', error);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
