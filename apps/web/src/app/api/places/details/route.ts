'use server';

import { NextRequest, NextResponse } from 'next/server';

function parseAddressComponents(components: Array<{ long_name: string; short_name: string; types: string[] }>) {
  let streetNumber = '';
  let route = '';
  let addressLine2 = '';
  let city = '';
  let state = '';
  let postcode = '';
  let country = 'AU';

  for (const component of components) {
    const types = component.types;
    if (types.includes('street_number')) streetNumber = component.long_name;
    if (types.includes('route')) route = component.long_name;
    if (types.includes('subpremise')) addressLine2 = component.long_name;
    if (types.includes('locality') || types.includes('sublocality')) city = component.long_name;
    if (types.includes('administrative_area_level_1')) state = component.short_name;
    if (types.includes('postal_code')) postcode = component.long_name;
    if (types.includes('country')) country = component.short_name;
  }

  return {
    address_line1: `${streetNumber} ${route}`.trim() || route,
    address_line2: addressLine2 || undefined,
    city,
    state,
    postcode,
    country,
  };
}

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get('placeId')?.trim() ?? '';
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'Google Maps API key is not configured' }, { status: 500 });
  }

  if (!placeId) {
    return NextResponse.json({ success: false, error: 'placeId is required' }, { status: 400 });
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'address_component,geometry,formatted_address');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), { cache: 'no-store' });
    const payload = await response.json() as {
      status?: string;
      result?: {
        address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
        geometry?: { location?: { lat: number; lng: number } };
      };
      error_message?: string;
    };

    if (!response.ok || payload.status !== 'OK' || !payload.result) {
      return NextResponse.json(
        { success: false, error: payload.error_message || 'Failed to load address details' },
        { status: 400 }
      );
    }

    const components = payload.result.address_components || [];
    const parsed = parseAddressComponents(components);
    const location = payload.result.geometry?.location;

    return NextResponse.json({
      success: true,
      data: {
        ...parsed,
        latitude: location?.lat,
        longitude: location?.lng,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load address details' },
      { status: 500 }
    );
  }
}
