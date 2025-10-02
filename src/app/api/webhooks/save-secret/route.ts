import { NextResponse } from 'next/server';
import { dopplerSetSecret } from '@/lib/doppler';

export async function POST(request: Request) {
  try {
    const { webhookId, headerName, headerValue } = await request.json();

    if (!webhookId || !headerName || !headerValue) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters' 
      }, { status: 400 });
    }

    // Create secret name for this webhook
    const sanitizedWebhookId = webhookId === 'new' ? 'NEW' : webhookId.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const secretName = `WEBHOOK_${sanitizedWebhookId}_AUTH`;
    const secretValue = JSON.stringify({ 
      headerName, 
      headerValue,
      createdAt: new Date().toISOString()
    });

    const dopplerResult = await dopplerSetSecret({
      project: process.env.DOPPLER_PROJECT!,
      config: process.env.DOPPLER_CONFIG!,
      name: secretName,
      value: secretValue,
    });

    if (!dopplerResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: dopplerResult.error 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      secretRef: secretName 
    });

  } catch (error) {
    console.error('Error saving webhook secret:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    }, { status: 500 });
  }
}
