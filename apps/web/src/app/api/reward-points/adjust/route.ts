import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { getRewardPointsSettings } from '@/app/actions/reward-points';

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

    const { data: actorProfile, error: actorError } = await supabase
      .from('profiles')
      .select('role_slug, full_name, email')
      .eq('id', user.id)
      .single();

    if (actorError || !actorProfile || actorProfile.role_slug !== 'admin') {
      return NextResponse.json({ error: 'Only admins can adjust reward points' }, { status: 403 });
    }

    const body = await request.json() as {
      userId?: string;
      pointsDelta?: number;
      description?: string;
    };

    const userId = String(body.userId || '').trim();
    const pointsDelta = Number(body.pointsDelta || 0);
    const description = String(body.description || '').trim();

    if (!userId || !Number.isFinite(pointsDelta) || pointsDelta === 0) {
      return NextResponse.json({ error: 'userId and a non-zero pointsDelta are required' }, { status: 400 });
    }

    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const { data: customerProfile, error: customerError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (customerError || !customerProfile) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const { data: currentBalanceRow } = await supabase
      .from('user_reward_points')
      .select('current_balance')
      .eq('user_id', userId)
      .maybeSingle();

    const currentBalance = Number(currentBalanceRow?.current_balance || 0);
    const balanceAfter = currentBalance + pointsDelta;
    if (balanceAfter < 0) {
      return NextResponse.json({ error: 'Adjustment would make balance negative' }, { status: 400 });
    }

    const settings = await getRewardPointsSettings();
    const dollarValue = Number((Math.abs(pointsDelta) * settings.dollars_per_point).toFixed(2));

    const { error: txError } = await supabase
      .from('reward_point_transactions')
      .insert({
        user_id: userId,
        order_id: null,
        transaction_type: 'adjusted',
        points: pointsDelta,
        points_balance_after: balanceAfter,
        description,
        metadata: {
          adjusted_by_user_id: user.id,
          adjusted_by_name: actorProfile.full_name ?? actorProfile.email ?? 'Admin',
          dollar_value: dollarValue,
          adjustment_type: pointsDelta > 0 ? 'credit' : 'debit',
        },
      });

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      balanceAfter,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to adjust reward points' },
      { status: 500 }
    );
  }
}
