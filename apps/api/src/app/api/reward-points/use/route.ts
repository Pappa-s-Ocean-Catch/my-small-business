import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@my-small-business/supabase/server';
import { useRewardPoints } from '@/app/actions/reward-points';

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

    const body = await request.json() as {
      userId?: string;
      orderId?: string;
      pointsToUse?: number;
    };

    const userId = String(body.userId || '').trim();
    const orderId = String(body.orderId || '').trim();
    const pointsToUse = Number(body.pointsToUse || 0);

    if (!userId || !orderId || pointsToUse <= 0) {
      return NextResponse.json({ error: 'userId, orderId, and pointsToUse are required' }, { status: 400 });
    }

    const { data: existingTransaction, error: existingError } = await supabase
      .from('reward_point_transactions')
      .select('metadata, points')
      .eq('user_id', userId)
      .eq('order_id', orderId)
      .eq('transaction_type', 'used')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (existingTransaction) {
      const existingDollarValue = Number((existingTransaction.metadata as { dollar_value?: number } | null)?.dollar_value ?? 0);
      return NextResponse.json({
        success: true,
        dollarValue: existingDollarValue,
        alreadyApplied: true,
      });
    }

    const result = await useRewardPoints(userId, orderId, pointsToUse);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to apply reward points' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      dollarValue: result.dollarValue ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to apply reward points' },
      { status: 500 }
    );
  }
}
