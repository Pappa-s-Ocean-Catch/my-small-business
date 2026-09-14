import { NextResponse } from 'next/server';
import { authenticateStaffApiRequest } from '@/lib/staff-api-auth';
import { reconcileDeliveryRequest } from '@/lib/delivery-booking';
import { deliveryRepo, deliveryProvider } from '@/lib/delivery-management';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const auth = await authenticateStaffApiRequest(request);
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const result = await reconcileDeliveryRequest(params.id, deliveryRepo, deliveryProvider);
    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    if (err.message === 'Request not found') {
      return NextResponse.json({ success: false, error: err.message }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
