import { NextRequest, NextResponse } from 'next/server';
import { getGoogleBusinessProfileClient } from '@/lib/google-business-profile';

export async function GET(request: NextRequest) {
  try {
    const client = getGoogleBusinessProfileClient();
    const authUrl = client.getAuthUrl();
    
    return NextResponse.json({ 
      authUrl,
      message: 'Redirect to this URL to authorize Google Business Profile access'
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}

