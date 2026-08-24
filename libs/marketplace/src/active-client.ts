import type { MarketplaceActiveResult, MarketplaceProvider, MarketplaceSessionBundle } from './contracts';
import { buildDoorDashActivePayload, normalizeDoorDashActiveOrders } from './doordash-active';
import { buildUberActivePayload, normalizeUberActiveOrders } from './uber-active';

type DirectFetch = (url: string, init: RequestInit) => Promise<Response>;

export function createMarketplaceActiveClient(input: {
  getSession: (provider: MarketplaceProvider) => Promise<MarketplaceSessionBundle>;
  fetch?: DirectFetch;
}) {
  const directFetch = input.fetch ?? ((url, init) => globalThis.fetch(url, init));

  const getActiveOrders = async (provider: MarketplaceProvider, cursor?: string): Promise<MarketplaceActiveResult> => {
    const session = await input.getSession(provider);
    if (provider === 'uber_eats') {
      const response = await directFetch('https://merchants.ubereats.com/manager/api/getActiveOrders?localeCode=en-AU', {
        method: 'POST', headers: { accept: '*/*', 'content-type': 'application/json', origin: 'https://merchants.ubereats.com', referer: 'https://merchants.ubereats.com/manager/orders/active?dateRange=this_week', 'x-csrf-token': 'x', Cookie: session.cookies }, body: JSON.stringify(buildUberActivePayload(session.cookies, cursor)), cache: 'no-store',
      });
      const payload = await response.json().catch(() => null) as { status?: string; data?: { rows?: unknown[]; orders?: unknown[]; activeOrders?: unknown[]; paginationResult?: { nextCursor?: string } } } | null;
      if (!response.ok || payload?.status !== 'success') throw new Error(`Uber Eats active orders request failed (${response.status})`);
      return { provider, orders: normalizeUberActiveOrders((payload.data?.rows || payload.data?.orders || payload.data?.activeOrders || []) as never[]), nextCursor: payload.data?.paginationResult?.nextCursor || null };
    }
    const response = await directFetch('https://merchant-portal.doordash.com/merchant-analytics-service/api/v1/get_orders', { method: 'POST', headers: { accept: '*/*', 'content-type': 'application/json', origin: 'https://www.doordash.com', Cookie: session.cookies, ...(typeof session.providerConfig.ddAttKey === 'string' ? { 'dd-att-key': session.providerConfig.ddAttKey } : {}) }, body: JSON.stringify(buildDoorDashActivePayload(session.providerConfig)), cache: 'no-store' });
    const payload = await response.json().catch(() => null) as { orders?: unknown[]; message?: string } | null;
    if (!response.ok || !payload?.orders) throw new Error(payload?.message || `DoorDash active orders request failed (${response.status})`);
    return { provider, orders: normalizeDoorDashActiveOrders(payload.orders as never[]), nextCursor: null };
  };
  return { getActiveOrders };
}
