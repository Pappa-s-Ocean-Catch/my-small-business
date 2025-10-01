import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Row = {
  isoDate: string;
  importAmount: number;
  transactionDate: string;
  terminalId: string;
  transactionType: string;
  cardType: string;
  last4: string;
  purchase: number;
  surcharge: number;
  tips: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { currentUserId, rows } = body as { currentUserId?: string; rows?: Row[] };
    if (!currentUserId || !Array.isArray(rows)) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createServiceRoleClient();

    // Admin check
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_slug')
      .eq('id', currentUserId)
      .single();

    if (profileError || !profile || profile.role_slug !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    // Prepare inserts as income, category 'Sales', payment_method 'card'
    const inserts = rows.map((r) => ({
      date: r.isoDate,
      type: 'income' as const,
      category: 'Sales',
      amount: Number(r.importAmount.toFixed(2)),
      payment_method: 'card' as const,
      description: `SmartPay ${r.transactionType} ${r.cardType} ••••${r.last4} (term ${r.terminalId})`,
      reference_number: r.transactionDate,
      created_by: currentUserId,
    }));

    const { error: insErr } = await supabase
      .from('transactions')
      .insert(inserts);

    if (insErr) {
      return NextResponse.json({ success: false, error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, inserted: inserts.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}


