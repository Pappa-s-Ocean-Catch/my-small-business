import type { MarketplaceActiveResult, MarketplaceProvider, MarketplaceSessionBundle, MarketplaceTransport } from './contracts';
import { adaptDoorDashActive } from './doordash-adapter';
import { createDoorDashClient } from './doordash-client';
import { adaptUberActive } from './uber-eats-adapter';
import { createUberEatsClient } from './uber-eats-client';

type DirectFetch = (url: string, init: RequestInit) => Promise<Response>;

export function createMarketplaceActiveClient(input: { getSession: (provider: MarketplaceProvider) => Promise<MarketplaceSessionBundle>; fetch?: DirectFetch }) {
  const transport: MarketplaceTransport = async ({ url, init }) => (input.fetch ?? globalThis.fetch)(url, init);
  const uber = createUberEatsClient(transport);
  const doordash = createDoorDashClient(transport);
  const getActiveOrders = async (provider: MarketplaceProvider, cursor?: string): Promise<MarketplaceActiveResult> => {
    const session = await input.getSession(provider);
    if (provider === 'uber_eats') {
      const result = await uber.getActive(session, cursor); const payload = result.payload as any;
      if (payload?.status !== 'success') throw new Error(`Uber Eats active orders request failed (${result.status})`);
      const mapped = adaptUberActive(payload);
      console.info('[marketplace]', { provider: 'uber_eats', operation: 'active', status: result.status, providerRows: mapped.providerRows, rows: mapped.orders.length });
      return { provider, orders: mapped.orders, nextCursor: mapped.nextCursor };
    }
    const result = await doordash.getActive(session); const payload = result.payload as any;
    if (!Array.isArray(payload?.orders)) throw new Error('DoorDash active orders request failed');
    const mapped = adaptDoorDashActive(payload);
    console.info('[marketplace]', { provider: 'doordash', operation: 'active', status: result.status, providerRows: payload.orders.length, rows: mapped.orders.length });
    return { provider, orders: mapped.orders, nextCursor: mapped.nextCursor };
  };
  return { getActiveOrders };
}
