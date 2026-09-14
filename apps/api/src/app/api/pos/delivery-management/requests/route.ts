import { NextResponse } from 'next/server';
import { authenticateStaffApiRequest } from '@/lib/staff-api-auth';
import { bookDelivery } from '@/lib/delivery-booking';
import { deliveryRepo, deliveryProvider } from '@/lib/delivery-management';

export async function POST(request: Request) {
  const auth = await authenticateStaffApiRequest(request);
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const result = await bookDelivery(body, deliveryRepo, deliveryProvider);
    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
