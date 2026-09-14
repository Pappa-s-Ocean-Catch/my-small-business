import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { refreshShipdayOrderStatus } from '@/app/actions/shipday';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const supabase = await createServiceRoleClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_slug')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile lookup failed' }, { status: 500 });
    }

    if (profile.role_slug !== 'admin' && profile.role_slug !== 'staff') {
      return NextResponse.json({ success: false, error: 'Forbidden - Staff or admin access required' }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as { orderId?: string } | null;
    const orderId = body?.orderId?.trim();

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 });
    }

    const result = await refreshShipdayOrderStatus(orderId);
    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
