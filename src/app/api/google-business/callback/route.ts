import { NextRequest, NextResponse } from 'next/server';
import { getGoogleBusinessProfileClient } from '@/lib/google-business-profile';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.json(
        { error: `OAuth error: ${error}` },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code not provided' },
        { status: 400 }
      );
    }

    const client = getGoogleBusinessProfileClient();
    const tokens = await client.getTokens(code);

    // In a real implementation, you would store these tokens securely
    // For now, we'll return them to the client
    return NextResponse.json({
      success: true,
      message: 'Successfully authenticated with Google Business Profile',
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expiry_date,
      }
    });

  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    return NextResponse.json(
      { error: 'Failed to complete OAuth authentication' },
      { status: 500 }
    );
  }
}

