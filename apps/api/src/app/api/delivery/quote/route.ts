import { validateDeliverySchedule } from '@my-small-business/shipday/scheduling';
import { NextRequest, NextResponse } from 'next/server';
import { getShipdayClient } from '@my-small-business/shipday';
import type { DeliveryAddress } from '@my-small-business/shipday';

interface QuoteRequest {
  pickup_address: DeliveryAddress;
  dropoff_address: DeliveryAddress;
  scheduled_pickup_at?: string | null;
  scheduled_delivery_at?: string | null;
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

    const scheduleError = validateDeliverySchedule(true, body.scheduled_pickup_at, body.scheduled_delivery_at);
    if (scheduleError) return NextResponse.json({ error: scheduleError }, { status: 400 });

    // Request quote from Shipday
    const client = getShipdayClient();
    const quote = await client.requestQuote(body.pickup_address, body.dropoff_address, { pickup_at: body.scheduled_pickup_at, delivery_at: body.scheduled_delivery_at });
    console.log('[Delivery Quote] Received quote:', quote);
    return NextResponse.json({
      success: true,
      data: {
        quote_id: quote.quote_id,
        fee: quote.fee,
        currency: quote.currency,
        provider_name: quote.provider_name,
        expires_at: quote.expires_at,
        estimated_duration_seconds: quote.estimated_duration_seconds,
        estimated_duration_minutes: quote.estimated_duration_minutes,
        distance_km: quote.distance_km,
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
