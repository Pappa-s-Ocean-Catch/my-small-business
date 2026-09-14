import { NextResponse } from 'next/server';
import { dopplerSetSecret } from '@/lib/doppler';

export async function POST(request: Request) {
  try {
    const { webhookId, headerName, headerValue, queryParamName, queryParamValue } = await request.json();

    if (!webhookId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameter webhookId' 
      }, { status: 400 });
    }

    // Require at least one method configured
    const hasHeader = !!headerName && !!headerValue;
    const hasQuery = !!queryParamName && !!queryParamValue;
    if (!hasHeader && !hasQuery) {
      return NextResponse.json({ 
        success: false, 
        error: 'You must provide either headerName/headerValue or queryParamName/queryParamValue' 
      }, { status: 400 });
    }

    // Create secret name for this webhook
    const sanitizedWebhookId = webhookId === 'new' ? 'NEW' : webhookId.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const secretName = `WEBHOOK_${sanitizedWebhookId}_AUTH`;
    // New structured format for Doppler secret storage
    const secretValue = JSON.stringify({ 
      header: hasHeader ? { key: headerName, value: headerValue } : undefined,
      query: hasQuery ? { key: queryParamName, value: queryParamValue } : undefined,
      createdAt: new Date().toISOString(),
      // Back-compat fields for older readers (can be removed later)
      headerName: hasHeader ? headerName : undefined, 
      headerValue: hasHeader ? headerValue : undefined,
      queryParamName: hasQuery ? queryParamName : undefined,
      queryParamValue: hasQuery ? queryParamValue : undefined
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
