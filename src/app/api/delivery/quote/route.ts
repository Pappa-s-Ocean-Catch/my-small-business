import { NextRequest, NextResponse } from 'next/server';
import { getUberDirectClient } from '@/lib/uber-direct';
import type { DeliveryAddress } from '@/lib/uber-direct';

interface QuoteRequest {
  pickup_address: DeliveryAddress;
  dropoff_address: DeliveryAddress;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as QuoteRequest;

    // Validate required fields
    if (!body.pickup_address || !body.dropoff_address) {
      return NextResponse.json(
        { error: 'Pickup and dropoff addresses are required' },
        { status: 400 }
      );
    }

    // Validate address fields
    if (!body.pickup_address.address_line1 || !body.pickup_address.city || 
        !body.pickup_address.state || !body.pickup_address.postcode) {
      return NextResponse.json(
        { error: 'Pickup address is incomplete' },
        { status: 400 }
      );
    }

    if (!body.dropoff_address.address_line1 || !body.dropoff_address.city || 
        !body.dropoff_address.state || !body.dropoff_address.postcode) {
      return NextResponse.json(
        { error: 'Dropoff address is incomplete' },
        { status: 400 }
      );
    }

    // Get store address from environment or use default
    // TODO: Make this configurable in settings
    const storeAddress: DeliveryAddress = {
      address_line1: process.env.STORE_ADDRESS_LINE1 || '123 Main Street',
      address_line2: process.env.STORE_ADDRESS_LINE2,
      city: process.env.STORE_CITY || 'Melton',
      state: process.env.STORE_STATE || 'VIC',
      postcode: process.env.STORE_POSTCODE || '3337',
      country: 'AU',
      latitude: process.env.STORE_LATITUDE ? parseFloat(process.env.STORE_LATITUDE) : undefined,
      longitude: process.env.STORE_LONGITUDE ? parseFloat(process.env.STORE_LONGITUDE) : undefined,
    };

    // Request quote from Uber Direct
    const client = getUberDirectClient();
    const quote = await client.requestQuote(storeAddress, body.dropoff_address);

    // Calculate ETA in minutes
    const etaMinutes = Math.ceil(quote.estimated_duration_seconds / 60);

    return NextResponse.json({
      success: true,
      data: {
        quote_id: quote.quote_id,
        fee: quote.fee,
        currency: quote.currency,
        expires_at: quote.expires_at,
        estimated_pickup_time: quote.estimated_pickup_time,
        estimated_delivery_time: quote.estimated_delivery_time,
        estimated_duration_seconds: quote.estimated_duration_seconds,
        estimated_duration_minutes: etaMinutes,
      },
    });
  } catch (error) {
    console.error('[Delivery Quote] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get delivery quote',
      },
      { status: 500 }
    );
  }
}
