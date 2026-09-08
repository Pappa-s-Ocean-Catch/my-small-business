import { NextResponse } from 'next/server';
import { authenticateStaffApiRequest } from '@/lib/staff-api-auth';
import { getShipdayManagementClient } from '../../../../../../../../libs/shipday/management';

export async function GET(request: Request) {
  const auth = await authenticateStaffApiRequest(request);
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const from = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = searchParams.get('to') || new Date().toISOString();
  const page = parseInt(searchParams.get('page') || '1', 10);

  try {
    const client = getShipdayManagementClient();
    const result = await client.listOrders({ status, from, to, page });
    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
