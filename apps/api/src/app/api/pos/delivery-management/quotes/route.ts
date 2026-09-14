import { NextResponse } from 'next/server';
import { authenticateStaffApiRequest } from '@/lib/staff-api-auth';
import { getShipdayManagementClient, getDeliveryStoreAddress } from '../../../../../../../../libs/shipday/management';
import { DeliveryJobAddress } from '../../../../../../../../libs/types/delivery-management';
import { deliveryRepo } from '@/lib/delivery-management';

export async function POST(request: Request) {
  const auth = await authenticateStaffApiRequest(request);
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const address: DeliveryJobAddress = body.address;
    if (!address || !address.address_line1) {
      return NextResponse.json({ success: false, error: 'Invalid address' }, { status: 400 });
    }

    const client = getShipdayManagementClient();
    const quotes = await client.getQuotes(address);
    
    // Create new request record
    const { supabase } = auth;
    const reference = `DOD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { data: requestRecord, error } = await supabase.from('delivery_requests').insert({
      reference,
      state: 'quoted',
      quotes,
      address,
      expires_at: expiresAt
    }).select().single();

    if (error || !requestRecord) {
      throw new Error('Failed to create delivery request record');
    }

    const formattedRequest = {
      id: requestRecord.id,
      reference: requestRecord.reference,
      state: requestRecord.state,
      shipdayOrderId: null,
      orderId: null,
      quotes: requestRecord.quotes,
      expiresAt: requestRecord.expires_at,
      error: null,
      trackingUrl: null
    };

    return NextResponse.json({
      success: true,
      data: {
        request: formattedRequest,
        pickupAddress: getDeliveryStoreAddress()
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
