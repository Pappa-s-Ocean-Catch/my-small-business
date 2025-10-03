import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getDopplerSecret } from '@/lib/doppler';
import type { SupabaseClient } from '@supabase/supabase-js';

// GET - Retrieve webhook configuration (for testing)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Use service role for reliable access to config regardless of RLS
    const supabase = await createServiceRoleClient();
    const { id } = await params;
    
    
    // Try lookup by id first
    let { data: webhook, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    

    // Fallback: if not found by id, attempt by name using the same param
    if ((!webhook || error) && id) {
      const byName = await supabase
        .from('webhooks')
        .select('*')
        .ilike('name', id)
        .maybeSingle();
      webhook = byName.data as any;
      error = byName.error as any;
      
    }

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

    // Optionally include a resolved copy URL with query string if configured
    let copyUrl: string | undefined = undefined;
    try {
      const urlObj = new URL(request.url);
      const origin = `${urlObj.protocol}//${urlObj.host}`;
      const base = `${origin}/api/webhook/${encodeURIComponent(webhook.name)}`;
      

      if (webhook.secret_ref) {
        const secret = await getDopplerSecret(webhook.secret_ref);
        
        if (secret.success && secret.value) {
          const unwrap = (v: unknown): string => {
            if (typeof v === 'string') return v;
            if (v && typeof v === 'object') {
              const obj = v as { raw?: unknown; computed?: unknown };
              if (typeof obj.computed === 'string') return obj.computed;
              if (typeof obj.raw === 'string') return obj.raw;
            }
            return JSON.stringify(v);
          };
          const rawSecret = unwrap(secret.value);
          const cfg = JSON.parse(rawSecret) as { header?: { key?: string; value?: string }; query?: { key?: string; value?: string }; headerName?: string; headerValue?: string; queryParamName?: string; queryParamValue?: string };
          const sp = new URLSearchParams();
          if ((cfg.query && cfg.query.key && cfg.query.value)) {
            sp.set(cfg.query.key, cfg.query.value);
          } else if (cfg.queryParamName && cfg.queryParamValue) {
            sp.set(cfg.queryParamName, cfg.queryParamValue);
          } else if (cfg.headerValue) {
            // Fallback: use common ?secret=
            sp.set('secret', cfg.headerValue);
          }
          copyUrl = sp.toString() ? `${base}?${sp.toString()}` : base;
          
        } else {
          copyUrl = base;
          
        }
      } else {
        copyUrl = base;
        
      }
    } catch {
      // ignore copyUrl build errors
      
    }

    return NextResponse.json({ 
      success: true, 
      webhook: {
        id: webhook.id,
        name: webhook.name,
        webhook_type: webhook.webhook_type,
        is_enabled: webhook.is_enabled
      },
      copy_url: copyUrl
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
    // Dump full body
    console.log(`[webhook ${webhook.name}] received body:`, body);

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
    {
      const raw = typeof secretResult.value === 'string' ? secretResult.value : JSON.stringify(secretResult.value);
      console.log('[webhooks id POST] doppler raw secret', {
        length: raw.length,
        preview: raw.slice(0, 8) + '...'
      });
    }

    // Normalize Doppler secret wrapper and parse inner JSON if needed
    const unwrapDopplerValue = (v: unknown): string => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object') {
        const obj = v as { raw?: unknown; computed?: unknown };
        if (typeof obj.computed === 'string') return obj.computed;
        if (typeof obj.raw === 'string') return obj.raw;
      }
      return JSON.stringify(v);
    };
    const rawSecret = unwrapDopplerValue(secretResult.value);
    let authConfig: { header?: { key?: string; value?: string }; query?: { key?: string; value?: string }; headerName?: string; headerValue?: string; queryParamName?: string; queryParamValue?: string };
    try {
      authConfig = JSON.parse(rawSecret) as { header?: { key?: string; value?: string }; query?: { key?: string; value?: string }; headerName?: string; headerValue?: string; queryParamName?: string; queryParamValue?: string };
    } catch {
      console.warn('[webhooks id POST] secret JSON parse failed; using raw token fallback');
      authConfig = { headerValue: rawSecret } as any;
    }
    const expectedHeaderName = authConfig.header?.key ?? authConfig.headerName ?? '';
    const expectedHeaderValue = authConfig.header?.value ?? authConfig.headerValue ?? '';
    const expectedQueryParamName = authConfig.query?.key ?? authConfig.queryParamName ?? '';
    const expectedQueryParamValue = authConfig.query?.value ?? authConfig.queryParamValue ?? '';

    if (!expectedHeaderValue && !expectedQueryParamValue) {
      return { success: false, error: 'Authentication configuration invalid' };
    }

    // 1) Header-based authentication (configured header)
    if (expectedHeaderName && expectedHeaderValue) {
      const actualHeaderValue = request.headers.get(expectedHeaderName) ?? '';
      if (actualHeaderValue === expectedHeaderValue) {
        return { success: true };
      }
    }

    // 1a) Fallback common header name: x-webhook-secret
    if (expectedHeaderValue) {
      const commonHeaderValue = request.headers.get('x-webhook-secret') ?? '';
      if (commonHeaderValue === expectedHeaderValue) {
        return { success: true };
      }
    }

    // 2) Query string authentication with custom param name if provided
    const url = new URL(request.url);
    if (expectedQueryParamName && expectedQueryParamValue) {
      const provided = url.searchParams.get(expectedQueryParamName) ?? '';
      if (provided === expectedQueryParamValue) {
        return { success: true };
      }
    }

    // 2a) Fallback common query param names: ?secret= or ?api_secret=
    if (expectedHeaderValue) {
      const provided = (url.searchParams.get('secret') ?? url.searchParams.get('api_secret') ?? '');
      if (provided === expectedHeaderValue) {
        return { success: true };
      }
    }

    return { success: false, error: 'Invalid authentication credentials' };

  } catch (error) {
    console.error('Error authenticating webhook:', error);
    return { success: false, error: 'Authentication failed' };
  }
}
