import { NextResponse } from 'next/server';

import {
  getMarketplaceCredentialStatus,
  parseMarketplaceProvider,
  saveMarketplaceCookies,
} from '@/lib/marketplace-credentials';
import {
  getMarketplaceExtensionCorsHeaders,
  isMarketplaceExtensionSecretValid,
  syncMarketplaceExtensionCredentials,
} from '@/lib/marketplace-extension-sync';

const MAX_COOKIE_BYTES = 64 * 1024;

function corsHeaders(request: Request) {
  return getMarketplaceExtensionCorsHeaders(
    request.headers.get('origin'),
    process.env.MARKETPLACE_EXTENSION_ALLOWED_ORIGIN,
  );
}

function jsonResponse(request: Request, body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: corsHeaders(request) });
}

export function OPTIONS(request: Request) {
  const headers = corsHeaders(request);
  if (!headers['Access-Control-Allow-Origin']) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers });
}

function validationError(provider: 'uber_eats' | 'doordash') {
  return provider === 'uber_eats'
    ? 'Uber Eats session validation failed'
    : 'DoorDash session validation failed';
}

async function validateMarketplaceCookies(
  provider: 'uber_eats' | 'doordash',
  cookies: string,
) {
  const status = await getMarketplaceCredentialStatus(provider);
  const providerConfig = status.providerConfig;

  if (provider === 'uber_eats') {
    const selectedRestaurant = cookies.match(/(?:^|;\s*)selectedRestaurant=([^;]+)/)?.[1]?.trim();
    if (!selectedRestaurant) return { ok: false, error: validationError(provider) };

    const response = await fetch('https://merchants.ubereats.com/manager/api/getActiveOrders?localeCode=en-AU', {
      method: 'POST',
      headers: {
        accept: '*/*',
        'content-type': 'application/json',
        origin: 'https://merchants.ubereats.com',
        referer: 'https://merchants.ubereats.com/manager/orders/active?dateRange=this_week',
        'x-csrf-token': 'x',
        Cookie: cookies,
      },
      body: JSON.stringify({
        filters: {
          currentTab: 'activeOrders',
          displayCurrencyCode: 'AUD',
          isEatsPassSubscriber: false,
          locationConstraints: { cities: [], countries: [], locationUuids: [selectedRestaurant] },
          orderIssuesV2: [],
          issueOrderStatusFilter: [],
          search: '',
          displayByocIssues: false,
        },
        pagination: { limit: 1, cursor: '', nextTable: '' },
        sort: { sortColumn: null, sortDirection: null },
      }),
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => null) as { status?: string } | null;
    return payload?.status === 'success'
      ? { ok: true, providerConfig }
      : { ok: false, error: validationError(provider) };
  }

  const businessId = Number(providerConfig.businessId);
  const storeId = Number(providerConfig.storeId);
  if (!businessId || !storeId) return { ok: false, error: 'DoorDash store configuration is missing' };

  const ddAttKey = typeof providerConfig.ddAttKey === 'string' ? providerConfig.ddAttKey.trim() : '';
  const response = await fetch('https://merchant-portal.doordash.com/merchant-analytics-service/api/v1/get_orders', {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
      origin: 'https://www.doordash.com',
      referer: 'https://www.doordash.com/',
      ...(ddAttKey ? { 'dd-att-key': ddAttKey } : {}),
      Cookie: cookies,
    },
    body: JSON.stringify({
      businessIds: [businessId], organizations: [], storeIds: [storeId], type: 'active', statuses: [], subStatuses: [], limit: 1,
    }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as { orders?: unknown[] } | null;
  return response.ok && Array.isArray(payload?.orders)
    ? { ok: true, providerConfig }
    : { ok: false, error: validationError(provider) };
}

export async function POST(request: Request) {
  const configuredSecret = process.env.MARKETPLACE_EXTENSION_SYNC_SECRET;
  if (!configuredSecret || !isMarketplaceExtensionSecretValid(request.headers.get('X-Marketplace-Sync-Key'), configuredSecret)) {
    return jsonResponse(request, { success: false, error: 'Unauthorized extension sync request' }, 401);
  }

  try {
    const body = await request.json().catch(() => null) as { provider?: string; cookies?: string } | null;
    const provider = body?.provider ? parseMarketplaceProvider(body.provider) : null;
    const cookies = body?.cookies?.trim();
    if (!provider || !cookies || Buffer.byteLength(cookies, 'utf8') > MAX_COOKIE_BYTES) {
      return jsonResponse(request, { success: false, error: 'Invalid marketplace session payload' }, 400);
    }

    const existingCredential = await getMarketplaceCredentialStatus(provider);
    const result = await syncMarketplaceExtensionCredentials({
      provider,
      cookies,
      validate: validateMarketplaceCookies,
      save: async (input) => {
        await saveMarketplaceCookies({
          ...input,
          providerConfig: {
            ...input.providerConfig,
            updatedViaExtension: true,
          },
          configuredBy: existingCredential.configuredBy,
        });
      },
    });
    if (!result.success) {
      return jsonResponse(request, { success: false, error: result.error }, 422);
    }

    const status = await getMarketplaceCredentialStatus(provider);
    return jsonResponse(request, { success: true, data: { provider, updatedAt: status.updatedAt } }, 200);
  } catch {
    return jsonResponse(request, { success: false, error: 'Marketplace session sync failed' }, 500);
  }
}
