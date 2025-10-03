import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getDopplerSecret } from '@/lib/doppler';

type WebhookRow = {
  id: string;
  name: string;
  description: string | null;
  webhook_type: string;
  secret_ref: string | null;
  is_enabled: boolean;
  created_by: string | null;
};

async function authenticateIfNeeded(request: Request, secretRef: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!secretRef) return { ok: true };

  const secretResult = await getDopplerSecret(secretRef);
  if (!secretResult.success || !secretResult.value) {
    return { ok: false, error: 'Authentication configuration not found' };
  }

  try {
    const parsed = JSON.parse(secretResult.value) as { headerName?: string; headerValue?: string };
    const expectedHeaderName = parsed.headerName ?? '';
    const expectedHeaderValue = parsed.headerValue ?? '';
    if (!expectedHeaderName || !expectedHeaderValue) {
      return { ok: false, error: 'Authentication configuration invalid' };
    }
    const actualValue = request.headers.get(expectedHeaderName) ?? '';
    if (actualValue !== expectedHeaderValue) {
      return { ok: false, error: 'Invalid authentication credentials' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Failed to parse authentication configuration' };
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { name } = await params;

    const { data: webhook, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('name', name)
      .maybeSingle<WebhookRow>();

    if (error || !webhook) {
      return NextResponse.json({ success: false, error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      webhook: { id: webhook.id, name: webhook.name, is_enabled: webhook.is_enabled, webhook_type: webhook.webhook_type },
    });
  } catch (e) {
    console.error('[webhook name GET] error', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const supabase = await createServerSupabaseClient();
    const { name } = await params;

    const { data: webhook, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('name', name)
      .maybeSingle<WebhookRow>();

    if (error || !webhook) {
      return NextResponse.json({ success: false, error: 'Webhook not found' }, { status: 404 });
    }
    if (!webhook.is_enabled) {
      return NextResponse.json({ success: false, error: 'Webhook is disabled' }, { status: 403 });
    }

    const auth = await authenticateIfNeeded(request, webhook.secret_ref);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const body = await request.json();

    // For now: dump input JSON back (echo) along with webhook metadata
    return NextResponse.json({
      success: true,
      webhook: { id: webhook.id, name: webhook.name, webhook_type: webhook.webhook_type },
      received: body,
    });
  } catch (e) {
    console.error('[webhook name POST] error', e);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}


