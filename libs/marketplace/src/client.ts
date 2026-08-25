import type { MarketplaceHistoryOptions, MarketplaceOrderDetail, MarketplaceProvider, MarketplaceProviderClient, MarketplaceSessionBundle, MarketplaceTransport } from './contracts';
import { adaptDoorDashDetail, adaptDoorDashHistory } from './doordash-adapter';
import { createDoorDashClient } from './doordash-client';
import { adaptUberDetail, adaptUberHistory, adaptUberScheduled } from './uber-eats-adapter';
import { createUberEatsClient, type MarketplaceDateParts } from './uber-eats-client';
import { createMarketplaceActiveClient } from './active-client';

const MELBOURNE = 'Australia/Melbourne';
function melbourneDateParts(now: Date): MarketplaceDateParts { const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: MELBOURNE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])); return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) }; }
function shift(parts: MarketplaceDateParts, days: number): MarketplaceDateParts { const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days)); return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }; }
function historyRange(kind: string | undefined, now = new Date()) { let start = melbourneDateParts(now); let end = start; if (kind === 'YESTERDAY') start = end = shift(start, -1); else if (kind === 'THIS_WEEK') { const day = new Date(Date.UTC(start.year, start.month - 1, start.day)).getUTCDay(); start = shift(start, day === 0 ? -6 : 1 - day); } else if (kind === 'THIS_MONTH') start = { ...start, day: 1 }; else if (kind === 'LAST_7_DAYS') start = shift(start, -6); else if (kind === 'LAST_30_DAYS') start = shift(start, -29); else if (kind === 'LAST_12_WEEKS') start = shift(start, -83); return { start, end }; }

export function createMarketplaceProviderClient(input: { getSession: (provider: MarketplaceProvider) => Promise<MarketplaceSessionBundle>; transport?: MarketplaceTransport }): MarketplaceProviderClient {
  const transport = input.transport ?? ((request) => fetch(request.url, request.init));
  const uber = createUberEatsClient(transport);
  const doordash = createDoorDashClient(transport);
  const active = createMarketplaceActiveClient({ getSession: input.getSession, fetch: (url, init) => transport({ url, init }) });
  return {
    getActiveOrders: active.getActiveOrders,
    async getHistory(provider, options: MarketplaceHistoryOptions = {}) {
      const session = await input.getSession(provider); const range = historyRange(options.dateRange);
      if (provider === 'uber_eats') {
        const result = await uber.getHistory(session, range, options); const payload = result.payload as any;
        if ((options.mode ?? 'history') === 'scheduled') { if (!Array.isArray(payload?.data?.ordersV2?.rows)) throw new Error('Uber Eats scheduled history request failed'); return adaptUberScheduled(payload); }
        if (payload?.status !== 'success') throw new Error('Uber Eats history request failed');
        const mapped = adaptUberHistory(payload); console.info('[marketplace]', { provider: 'uber_eats', operation: 'history-result', mode: options.mode ?? 'history', providerRows: payload.data?.orders?.length || 0, rows: mapped.orders.length }); return mapped;
      }
      const result = await doordash.getHistory(session, range, options); const payload = result.payload as any;
      if (!Array.isArray(payload?.orders)) throw new Error(`DoorDash ${options.mode ?? 'history'} request failed`);
      return adaptDoorDashHistory(payload, options.mode ?? 'history');
    },
    async getOrderDetail(provider, workflowUuid, options = {}): Promise<MarketplaceOrderDetail> {
      const session = await input.getSession(provider);
      if (provider === 'uber_eats') { const result = await uber.getOrderDetail(session, workflowUuid, options.mode); if (!result.detail) throw new Error('Uber Eats order detail request failed'); return adaptUberDetail(result.detail as any, workflowUuid); }
      const result = await doordash.getOrderDetail(session, workflowUuid, options.mode); if (!result.detail) throw new Error('DoorDash order detail request failed'); return adaptDoorDashDetail(result.detail as any, workflowUuid);
    },
  };
}
