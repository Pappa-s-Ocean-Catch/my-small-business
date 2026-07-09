'use server';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get('input')?.trim() ?? '';
  const country = request.nextUrl.searchParams.get('country')?.trim() ?? 'au';
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'Google Maps API key is not configured' }, { status: 500 });
  }

  if (input.length < 3) {
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('types', 'address');
    url.searchParams.set('components', `country:${country}`);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString(), { cache: 'no-store' });
    const payload = await response.json() as {
      status?: string;
      predictions?: Array<{
        place_id: string;
        description: string;
        structured_formatting?: {
          main_text?: string;
          secondary_text?: string;
        };
      }>;
      error_message?: string;
    };

    if (!response.ok || (payload.status && payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS')) {
      return NextResponse.json(
        { success: false, error: payload.error_message || 'Failed to autocomplete address' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: (payload.predictions || []).map((prediction) => ({
        placeId: prediction.place_id,
        description: prediction.description,
        mainText: prediction.structured_formatting?.main_text || prediction.description,
        secondaryText: prediction.structured_formatting?.secondary_text || '',
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to autocomplete address' },
      { status: 500 }
    );
  }
}
