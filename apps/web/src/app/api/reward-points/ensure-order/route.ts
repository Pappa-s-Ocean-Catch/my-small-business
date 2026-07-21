import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { ensureOrderRewardPoints } from '@/app/actions/reward-points';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const supabase = await createServiceRoleClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_slug')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role_slug === 'customer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json() as { orderId?: string };
    const orderId = String(body.orderId || '').trim();

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const result = await ensureOrderRewardPoints(orderId);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to ensure reward points' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      pointsEarned: result.pointsEarned ?? 0,
      skipped: Boolean(result.skipped),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to ensure reward points' },
      { status: 500 }
    );
  }
}
