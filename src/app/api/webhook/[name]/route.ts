import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
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
  // (debug logs removed)

  try {
    // Normalize Doppler secret format: may be string, or an object with raw/computed JSON strings
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
    let parsed: { header?: { key?: string; value?: string }; query?: { key?: string; value?: string }; headerName?: string; headerValue?: string; queryParamName?: string; queryParamValue?: string };
    try {
      parsed = JSON.parse(rawSecret) as { header?: { key?: string; value?: string }; query?: { key?: string; value?: string }; headerName?: string; headerValue?: string; queryParamName?: string; queryParamValue?: string };
    } catch (_parseErr) {
      // Fallback for legacy/plain secrets: treat entire value as the token
      console.warn('[webhook auth] secret JSON parse failed; using raw token fallback');
      parsed = { headerValue: rawSecret } as { headerValue: string };
    }
    const expectedHeaderName = parsed.header?.key ?? parsed.headerName ?? '';
    const expectedHeaderValue = parsed.header?.value ?? parsed.headerValue ?? '';
    const expectedQueryParamName = parsed.query?.key ?? parsed.queryParamName ?? '';
    const expectedQueryParamValue = parsed.query?.value ?? parsed.queryParamValue ?? '';

    if (!expectedHeaderValue && !expectedQueryParamValue) {
      return { ok: false, error: 'Authentication configuration invalid' };
    }

    // 1) Header-based authentication (configured header)
    if (expectedHeaderName && expectedHeaderValue) {
      const actualHeaderValue = (request.headers.get(expectedHeaderName) ?? '').trim();
      if (actualHeaderValue === expectedHeaderValue) {
        return { ok: true };
      }
    }

    // 1a) Fallback common header name: x-webhook-secret
    if (expectedHeaderValue) {
      const commonHeaderValue = (request.headers.get('x-webhook-secret') ?? '').trim();
      if (commonHeaderValue === expectedHeaderValue) {
        return { ok: true };
      }
    }

    // 2) Query string authentication with custom param name if provided
    const url = new URL(request.url);
    if (expectedQueryParamName && expectedQueryParamValue) {
      const provided = (url.searchParams.get(expectedQueryParamName) ?? '').trim();
      if (provided === expectedQueryParamValue) {
        return { ok: true };
      }
    }

    // 2a) Fallback common query param name: ?secret=
    if (expectedHeaderValue) {
      const provided = (url.searchParams.get('secret') ?? '').trim();
      if (provided === expectedHeaderValue) {
        return { ok: true };
      }
    }

    // 2b) Additional common query param: ?api_secret=
    if (expectedHeaderValue) {
      const provided = (url.searchParams.get('api_secret') ?? '').trim();
      if (provided === expectedHeaderValue) {
        return { ok: true };
      }
    }

    return { ok: false, error: 'Invalid authentication credentials' };
  } catch {
    return { ok: false, error: 'Failed to parse authentication configuration' };
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    // Use service role to reliably read webhook config regardless of user session
    const supabase = await createServiceRoleClient();
    const { name } = await params;
    

    const { data: webhook, error } = await supabase
      .from('webhooks')
      .select('*')
      .ilike('name', name)
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
    // Use service role to reliably read webhook config regardless of user session
    const supabase = await createServiceRoleClient();
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
    // Dump the full body received for this webhook
    console.log(`[webhook ${webhook.name}] received body:`, body);

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


