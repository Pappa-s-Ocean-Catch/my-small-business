import type { MarketplaceHistoryOptions, MarketplaceOrderDetailMode, MarketplaceSessionBundle, MarketplaceTransport } from './contracts';
import type { MarketplaceDateParts } from './uber-eats-client';
import { buildDoorDashActivePayload } from './doordash-active';
import { readMarketplaceResponse } from './provider-response';

type Range = { start: MarketplaceDateParts; end: MarketplaceDateParts };
const BROWSER_HEADERS = { priority: 'u=1, i', 'sec-ch-ua': '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"', 'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"macOS"', 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36' };
function headers(session: MarketplaceSessionBundle, detail = false) { const ddAttKey = typeof session.providerConfig.ddAttKey === 'string' ? session.providerConfig.ddAttKey : undefined; return { accept: detail ? 'application/json' : '*/*', 'accept-language': 'en-GB', 'content-type': 'application/json', origin: 'https://www.doordash.com', ...(detail ? { 'client-version': 'web version 2.0', 'origin-app': 'merchant_portal' } : {}), ...BROWSER_HEADERS, referer: 'https://www.doordash.com/', 'sec-fetch-site': 'same-site', ...(detail && ddAttKey ? { 'dd-att-key': ddAttKey } : {}), Cookie: session.cookies }; }
function boundary(parts: MarketplaceDateParts, end: boolean) { const guess = Date.UTC(parts.year, parts.month - 1, parts.day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0); const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Australia/Melbourne', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(guess)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])); const displayedAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second)); return new Date(guess - (displayedAsUtc - guess)).toISOString(); }
async function request(transport: MarketplaceTransport, operation: string, url: string, init: RequestInit) { const response = await transport({ url, init }); const { payload, rejection } = await readMarketplaceResponse(response); if (!response.ok) throw new Error(`DoorDash ${operation} request failed (${response.status}; response=${rejection})`); return { payload, status: response.status }; }

export function createDoorDashClient(transport: MarketplaceTransport) {
  return {
    async getActive(session: MarketplaceSessionBundle) {
      const body = buildDoorDashActivePayload(session.providerConfig);
      return request(transport, 'active', 'https://merchant-portal.doordash.com/merchant-analytics-service/api/v1/get_orders', { method: 'POST', headers: headers(session), body: JSON.stringify(body), cache: 'no-store' });
    },
    async getHistory(session: MarketplaceSessionBundle, range: Range, options: MarketplaceHistoryOptions) {
      const businessId = Number(session.providerConfig.businessId), storeId = Number(session.providerConfig.storeId); if (!businessId || !storeId) throw new Error('DoorDash history request failed: missing businessId or storeId'); const mode = options.mode ?? 'history';
      const body = { businessIds: [businessId], organizations: [], storeIds: [storeId], type: mode, statuses: mode === 'scheduled' ? ['SCHEDULED_DELIVERY_ORDER', 'SCHEDULED_PICKUP_ORDER'] : options.statuses || [], subStatuses: [], dateGte: boundary(range.start, false), dateLt: boundary(range.end, true), limit: 20 };
      return request(transport, mode, 'https://merchant-portal.doordash.com/merchant-analytics-service/api/v1/get_orders', { method: 'POST', headers: headers(session), body: JSON.stringify(body), cache: 'no-store' });
    },
    async getOrderDetail(session: MarketplaceSessionBundle, workflowUuid: string, _mode: MarketplaceOrderDetailMode = 'history') {
      const storeId = Number(session.providerConfig.storeId); if (!storeId) throw new Error('DoorDash order detail request failed: missing storeId');
      const result = await request(transport, 'order detail', 'https://merchant-portal.doordash.com/merchant-analytics-service/api/v1/orders_details/', { method: 'POST', headers: headers(session, true), body: JSON.stringify({ country: 'AU', storeId, deliveryUuid: workflowUuid }), cache: 'no-store' });
      return { ...result, detail: (result.payload as any)?.data };
    },
  };
}
