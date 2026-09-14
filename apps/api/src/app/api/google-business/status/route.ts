import { NextRequest, NextResponse } from 'next/server';
import { getGoogleBusinessProfileClient } from '@/lib/google-business-profile';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('locationId');
    const tokens = searchParams.get('tokens');

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    if (!tokens) {
      return NextResponse.json(
        { error: 'Authentication tokens are required' },
        { status: 401 }
      );
    }

    const client = getGoogleBusinessProfileClient();
    
    try {
      const parsedTokens = JSON.parse(tokens);
      client.setCredentials(parsedTokens);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid tokens format' },
        { status: 400 }
      );
    }

    const status = await client.getSyncStatus(locationId);

    return NextResponse.json({
      success: true,
      status: status
    });

  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

