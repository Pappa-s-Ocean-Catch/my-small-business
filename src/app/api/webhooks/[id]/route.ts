import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getDopplerSecret } from '@/lib/doppler';
import type { SupabaseClient } from '@supabase/supabase-js';

// GET - Retrieve webhook configuration (for testing)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { id } = await params;
    
    const { data: webhook, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !webhook) {
      return NextResponse.json({ 
        success: false, 
        error: 'Webhook not found' 
      }, { status: 404 });
    }

    if (!webhook.is_enabled) {
      return NextResponse.json({ 
        success: false, 
        error: 'Webhook is disabled' 
      }, { status: 403 });
    }

    return NextResponse.json({ 
      success: true, 
      webhook: {
        id: webhook.id,
        name: webhook.name,
        webhook_type: webhook.webhook_type,
        is_enabled: webhook.is_enabled
      }
    });

  } catch (error) {
    console.error('Error retrieving webhook:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// POST - Handle incoming webhook data
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { id } = await params;
    
    // Get webhook configuration
    const { data: webhook, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !webhook) {
      return NextResponse.json({ 
        success: false, 
        error: 'Webhook not found' 
      }, { status: 404 });
    }

    if (!webhook.is_enabled) {
      return NextResponse.json({ 
        success: false, 
        error: 'Webhook is disabled' 
      }, { status: 403 });
    }

    // Authenticate request if secret is configured
    if (webhook.secret_ref) {
      const authResult = await authenticateWebhook(request, webhook.secret_ref);
      if (!authResult.success) {
        return NextResponse.json({ 
          success: false, 
          error: authResult.error 
        }, { status: 401 });
      }
    }

    // Parse request body
    const body = await request.json();
    
    // Process data based on webhook type
    const result = await processWebhookData(webhook, body, supabase);
    
    if (!result.success) {
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Unknown error occurred'
      }, { status: 400 });
    }

    // Log webhook activity
    console.log(`Webhook ${webhook.name} processed ${webhook.webhook_type}:`, {
      webhookId: webhook.id,
      webhookType: webhook.webhook_type,
      result: result.data
    });

    return NextResponse.json({ 
      success: true, 
      data: result.data,
      webhook_type: webhook.webhook_type
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// Helper function to process webhook data based on type
async function processWebhookData(webhook: { id: string; name: string; webhook_type: string; created_by: string }, body: Record<string, unknown>, supabase: SupabaseClient) {
  try {
    switch (webhook.webhook_type) {
      case 'transaction':
        return await processTransactionWebhook(webhook, body, supabase);
      case 'inventory':
        return await processInventoryWebhook(webhook, body, supabase);
      case 'customer':
        return await processCustomerWebhook(webhook, body, supabase);
      case 'order':
        return await processOrderWebhook(webhook, body, supabase);
      default:
        return { success: false, error: 'Unknown webhook type' };
    }
  } catch (error) {
    console.error('Error processing webhook data:', error);
    return { success: false, error: 'Failed to process webhook data' };
  }
}

// Process transaction webhook data
async function processTransactionWebhook(webhook: { id: string; name: string; created_by: string }, body: Record<string, unknown>, supabase: SupabaseClient) {
  const requiredFields = ['amount', 'description'];
  const missingFields = requiredFields.filter(field => !body[field]);
  
  if (missingFields.length > 0) {
    return { success: false, error: `Missing required fields: ${missingFields.join(', ')}` };
  }

  const transactionData = {
    type: (body.type as string) || 'income',
    amount: parseFloat(body.amount as string),
    description: body.description as string,
    date: body.date ? new Date(body.date as string).toISOString() : new Date().toISOString(),
    category: (body.category as string) || 'Sales',
    payment_method: (body.payment_method as string) || 'Other',
    reference: (body.reference as string) || `Webhook: ${webhook.name}`,
    notes: (body.notes as string) || `Received via webhook: ${webhook.name}`,
    created_by: webhook.created_by
  };

  const { data: transaction, error: insertError } = await supabase
    .from('transactions')
    .insert(transactionData)
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  return { 
    success: true, 
    data: {
      id: transaction.id,
      amount: transaction.amount,
      type: transaction.type,
      description: transaction.description
    }
  };
}

// Process inventory webhook data
async function processInventoryWebhook(webhook: { id: string; name: string }, body: Record<string, unknown>, _supabase: SupabaseClient) {
  // For now, just log the inventory data
  // You can implement inventory processing logic here
  console.log('Inventory webhook data:', body);
  
  return { 
    success: true, 
    data: { message: 'Inventory data received', type: 'inventory' },
    error: undefined
  };
}

// Process customer webhook data
async function processCustomerWebhook(webhook: { id: string; name: string }, body: Record<string, unknown>, _supabase: SupabaseClient) {
  // For now, just log the customer data
  // You can implement customer processing logic here
  console.log('Customer webhook data:', body);
  
  return { 
    success: true, 
    data: { message: 'Customer data received', type: 'customer' },
    error: undefined
  };
}

// Process order webhook data
async function processOrderWebhook(webhook: { id: string; name: string }, body: Record<string, unknown>, _supabase: SupabaseClient) {
  // For now, just log the order data
  // You can implement order processing logic here
  console.log('Order webhook data:', body);
  
  return { 
    success: true, 
    data: { message: 'Order data received', type: 'order' },
    error: undefined
  };
}

// Helper function to authenticate webhook requests
async function authenticateWebhook(request: Request, secretRef: string) {
  try {
    // Get the secret from Doppler
    const secretResult = await getDopplerSecret(secretRef);
    if (!secretResult.success || !secretResult.value) {
      return { success: false, error: 'Authentication configuration not found' };
    }

    const authConfig = JSON.parse(secretResult.value);
    const expectedHeaderName = authConfig.headerName;
    const expectedHeaderValue = authConfig.headerValue;

    // Get the header value from the request
    const headerValue = request.headers.get(expectedHeaderName);
    
    if (!headerValue) {
      return { success: false, error: `Missing authentication header: ${expectedHeaderName}` };
    }

    if (headerValue !== expectedHeaderValue) {
      return { success: false, error: 'Invalid authentication credentials' };
    }

    return { success: true };

  } catch (error) {
    console.error('Error authenticating webhook:', error);
    return { success: false, error: 'Authentication failed' };
  }
}
