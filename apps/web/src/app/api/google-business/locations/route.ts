import { NextRequest, NextResponse } from 'next/server';
import { getGoogleBusinessProfileClient } from '@/lib/google-business-profile';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tokens = searchParams.get('tokens');

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

    // Get business account and locations
    const account = await client.getBusinessAccount();
    const locations = await client.getBusinessLocations(account.accounts?.[0]?.name || '');

    return NextResponse.json({
      success: true,
      account: account,
      locations: locations
    });

  } catch (error) {
    console.error('Error getting business locations:', error);
    return NextResponse.json(
      { error: 'Failed to get business locations' },
      { status: 500 }
    );
  }
}

