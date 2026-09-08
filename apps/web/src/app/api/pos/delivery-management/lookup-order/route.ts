import { NextResponse } from 'next/server';
import { authenticateStaffApiRequest } from '@/lib/staff-api-auth';
import { DeliveryJobAddress } from '../../../../../../../../libs/types/delivery-management';

export async function GET(request: Request) {
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
    const { supabase } = auth;
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, customer_phone, customer_email, delivery_address_line1, delivery_address_line2, delivery_city, delivery_state, delivery_postcode, delivery_country, delivery_instructions, delivery_provider_id')
      .eq('order_number', reference)
      .single();

    if (error || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    let address: DeliveryJobAddress | null = null;
    if (order.delivery_address_line1 && order.delivery_city) {
      address = {
        address_line1: order.delivery_address_line1,
        address_line2: order.delivery_address_line2,
        city: order.delivery_city,
        state: order.delivery_state || 'NSW',
        postcode: order.delivery_postcode || '',
        country: order.delivery_country || 'AU',
        delivery_instructions: order.delivery_instructions
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        reference: order.order_number,
        recipient: {
          name: order.customer_name || 'Customer',
          phone: order.customer_phone,
          email: order.customer_email
        },
        address,
        deliveryProviderId: order.delivery_provider_id
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
