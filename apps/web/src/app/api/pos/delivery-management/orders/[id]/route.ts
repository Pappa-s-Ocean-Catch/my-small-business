import { NextResponse } from 'next/server';
import { authenticateStaffApiRequest } from '@/lib/staff-api-auth';
import { getShipdayManagementClient } from '../../../../../../../../../libs/shipday/management';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await authenticateStaffApiRequest(request);
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const reference = searchParams.get('reference');
  if (!reference) {
    return NextResponse.json({ success: false, error: 'Missing reference' }, { status: 400 });
  }

  try {
    const client = getShipdayManagementClient();
    const result = await client.getOrderDetail(params.id, reference);
    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
