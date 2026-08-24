import type { MarketplaceHistoryOptions, MarketplaceHistoryResult, MarketplaceOrderDetail, MarketplaceProvider, MarketplaceProviderClient, MarketplaceSessionBundle, MarketplaceTransport } from './contracts';
import { createMarketplaceActiveClient } from './active-client';

const MELBOURNE = 'Australia/Melbourne';

function melbourneDateParts(now: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: MELBOURNE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function shift(parts: { year: number; month: number; day: number }, days: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function historyRange(kind: string | undefined, now = new Date()) {
  let start = melbourneDateParts(now);
  let end = start;
  if (kind === 'YESTERDAY') start = end = shift(start, -1);
  else if (kind === 'THIS_WEEK') { const day = new Date(Date.UTC(start.year, start.month - 1, start.day)).getUTCDay(); start = shift(start, day === 0 ? -6 : 1 - day); }
  else if (kind === 'THIS_MONTH') start = { ...start, day: 1 };
  else if (kind === 'LAST_7_DAYS') start = shift(start, -6);
  else if (kind === 'LAST_30_DAYS') start = shift(start, -29);
  else if (kind === 'LAST_12_WEEKS') start = shift(start, -83);
  return { start, end };
}

function melbourneBoundary(parts: { year: number; month: number; day: number }, end: boolean) {
  const guess = Date.UTC(parts.year, parts.month - 1, parts.day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: MELBOURNE, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(guess)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const displayedAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
  return new Date(guess - (displayedAsUtc - guess)).toISOString();
}

function restaurant(cookies: string) {
  const id = cookies.match(/(?:^|;\s*)selectedRestaurant=([^;]+)/)?.[1]?.trim();
  if (!id) throw new Error('Uber Eats request failed: missing selected restaurant');
  return id;
}

function amount(value: unknown) {
  if (typeof value === 'string') { const number = Number(value.replace(/[^0-9.-]/g, '')); return Number.isFinite(number) ? number : null; }
  if (value && typeof value === 'object' && typeof (value as { unitAmount?: unknown }).unitAmount === 'number') return (value as { unitAmount: number }).unitAmount / 100;
  return null;
}
function display(value: unknown) { const number = amount(value); return number == null ? null : `A$${number.toFixed(2)}`; }
function timestamp(value: unknown) { if (typeof value === 'number') return value < 1_000_000_000_000 ? value * 1000 : value; if (typeof value === 'string') { const parsed = Date.parse(value); return Number.isNaN(parsed) ? 0 : parsed; } return 0; }
function normalizeUberDetail(detail: any, workflowUuid: string): MarketplaceOrderDetail {
  const items = (detail.items || []).map((item: any) => ({ name: item.name || 'Item', price: item.price || '', quantity: item.quantity || 1, specialInstructions: item.specialInstructions || '', customizations: (item.customizations || []).map((group: any) => ({ name: group.name || 'Options', options: (group.options || []).map((option: any) => ({ name: option.name || 'Option', quantity: option.quantity || 1, price: option.price ?? null })) })) }));
  const checkoutInfo = (detail.checkoutInfo || []).map((entry: any) => ({ key: entry.key || '', amount: entry.amount || '', label: entry.label || '' }));
  const subtotal = checkoutInfo.find((entry: any) => entry.key.toLowerCase().includes('subtotal'))?.amount ?? null;
  return { provider: 'uber_eats', sourceName: 'Uber Eats', workflowUuid, orderId: detail.orderId || '', orderUUID: detail.orderUUID || '', requestedAt: timestamp(detail.requestedAt), completedAtTimestamp: detail.completedAtTimestamp ? timestamp(detail.completedAtTimestamp) : null, customerName: detail.eater?.name || 'Customer', customerPhone: detail.eater?.phone ?? null, customerAddress: detail.eater?.deliveryAddress ?? null, courierName: detail.courier?.name ?? null, courierPhone: detail.courier?.phone ?? null, restaurantName: detail.restaurant?.name || 'Restaurant', subtotal, subtotalAmount: amount(subtotal), discountLabel: null, discount: null, discountAmount: 0, total: subtotal, totalAmount: amount(subtotal), netPayout: detail.netPayout || '', marketplaceFeeRate: detail.marketplaceFeeRate ?? null, fulfillmentType: detail.fulfillmentType || '', orderJobState: detail.orderJobState ?? detail.issueSummary?.orderJobState ?? detail.issueSummaryV2?.orderJobState ?? null, statusDescription: detail.statusDescription ?? detail.issueSummary?.failureReason ?? detail.issueSummaryV2?.statusDescription ?? null, checkoutInfo, orderStateChanges: (detail.orderStateChanges || []).map((entry: any) => ({ changedAt: timestamp(entry.changedAt), orderState: entry.orderState || '' })), items };
}
function normalizeDoorDashDetail(detail: any, workflowUuid: string): MarketplaceOrderDetail {
  const items = (detail.orders || []).flatMap((order: any) => (order.orderItems || []).map((item: any) => ({ name: item.name || 'Item', price: item.price?.displayString || display(item.price) || '', quantity: item.quantity || 1, specialInstructions: item.specialInstructions || '', customizations: (item.itemExtras || []).map((extra: any) => ({ name: extra.title || extra.name || 'Options', options: (extra.itemExtraOptionsList || (extra.itemExtraOptions ? [extra.itemExtraOptions] : [])).map((option: any) => ({ name: option.name || 'Option', quantity: option.quantity || 1, price: option.price?.displayString || display(option.price) })) })) })));
  const total = detail.orderTotal?.displayString || display(detail.orderTotal);
  const subtotal = detail.preTaxTotal?.displayString || display(detail.preTaxTotal) || total;
  return { provider: 'doordash', sourceName: 'DoorDash', workflowUuid, orderId: detail.orderId || '', orderUUID: detail.deliveryUuid || '', requestedAt: timestamp(detail.orderDate), completedAtTimestamp: detail.completedTime ? timestamp(detail.completedTime) : null, customerName: detail.consumer?.informalName || detail.consumer?.formalNameAbbreviated || 'Customer', customerPhone: null, customerAddress: detail.deliveryAddress?.printableAddress || null, courierName: detail.dasher?.informalName || detail.dasher?.formalNameAbbreviated || null, courierPhone: null, restaurantName: detail.storeName || 'Restaurant', subtotal, subtotalAmount: amount(subtotal), discountLabel: detail.promoRedemptionDetails?.[0]?.promotionTitle || null, discount: null, discountAmount: 0, total, totalAmount: amount(total), netPayout: total || '', marketplaceFeeRate: null, fulfillmentType: detail.fulfillmentType || 'DOORDASH', orderJobState: detail.orderStatusDisplay || String(detail.orderStatus || ''), statusDescription: detail.orderExperience || 'DoorDash', checkoutInfo: [], orderStateChanges: [], items };
}

async function providerJson(transport: MarketplaceTransport, provider: string, operation: string, url: string, init: RequestInit) {
  const response = await transport({ url, init });
  const text = await response.text();
  let payload: any = null;
  try { payload = JSON.parse(text); } catch { /* status error below has no sensitive data */ }
  if (!response.ok) throw new Error(`${provider} ${operation} request failed (${response.status})`);
  return payload;
}

export function createMarketplaceProviderClient(input: { getSession: (provider: MarketplaceProvider) => Promise<MarketplaceSessionBundle>; transport?: MarketplaceTransport }): MarketplaceProviderClient {
  const transport = input.transport ?? ((request) => fetch(request.url, request.init));
  const active = createMarketplaceActiveClient({ getSession: input.getSession, fetch: (url, init) => transport({ url, init }) });

  return {
    getActiveOrders: active.getActiveOrders,
    async getHistory(provider, options = {}): Promise<MarketplaceHistoryResult> {
      const session = await input.getSession(provider);
      const { start, end } = historyRange(options.dateRange);
      const mode = options.mode ?? 'history';
      if (provider === 'uber_eats') {
        const toLocal = (date: typeof start, isEnd: boolean) => `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')} ${isEnd ? '23:59:59' : '00:00:00'}`;
        const body = { filters: { currentTab: '', displayCurrencyCode: '', locationConstraints: { cities: [], countries: [], locationUuids: [restaurant(session.cookies)] }, dateFilter: { startDate: toLocal(start, false), endDate: toLocal(end, true), lastUpdatedAt: '' }, isEatsPassSubscriber: false, search: null, orderIssuesV2: [], issueOrderStatusFilter: [], displayByocIssues: false }, sort: { sortColumn: 'SORT_COLUMN_ORDER_COMPLETED_AT', sortDirection: 'SORT_DIRECTION_DESC' }, pagingInfo: { cursor: options.cursor || '', limit: 20, nextTable: 'liveOrders' } };
        const payload = await providerJson(transport, 'Uber Eats', 'history', 'https://merchants.ubereats.com/manager/api/getHistoricOrders?localeCode=en-GB', { method: 'POST', headers: { accept: '*/*', 'content-type': 'application/json', origin: 'https://merchants.ubereats.com', 'x-csrf-token': 'x', Cookie: session.cookies }, body: JSON.stringify(body), cache: 'no-store' });
        if (payload?.status !== 'success') throw new Error('Uber Eats history request failed');
        const rows = payload?.data?.orders || [];
        return { provider, orders: rows.map((order: any) => ({ orderId: order.orderId || '', workflowUuid: order.workflowUuid || '', orderUuid: order.orderUuid || '', customerName: order.eater?.name || 'Customer', salesTotal: order.salesTotal || '', netPayout: order.netPayout || order.payout || order.restaurantPayout || '', requestedAt: order.requestedAt || '', courierName: order.courierName || '', fulfillmentType: order.fulfillmentType || '', issueType: order.issueType || '', orderChannel: order.orderChannel || '', isSubscriber: !!order.eater?.isEatsPassSubscriber, subscriptionPass: order.eater?.subscriptionPass || '' })).filter((order: any) => order.orderId && order.workflowUuid), nextCursor: payload?.data?.paginationResult?.nextCursor || payload?.data?.pagination?.cursor || null };
      }
      const businessId = Number(session.providerConfig.businessId), storeId = Number(session.providerConfig.storeId);
      if (!businessId || !storeId) throw new Error('DoorDash history request failed: missing businessId or storeId');
      const body = { businessIds: [businessId], organizations: [], storeIds: [storeId], type: mode, statuses: mode === 'scheduled' ? ['SCHEDULED_DELIVERY_ORDER', 'SCHEDULED_PICKUP_ORDER'] : options.statuses || [], subStatuses: [], dateGte: melbourneBoundary(start, false), dateLt: melbourneBoundary(end, true), limit: 20 };
      const payload = await providerJson(transport, 'DoorDash', mode, 'https://merchant-portal.doordash.com/merchant-analytics-service/api/v1/get_orders', { method: 'POST', headers: { accept: '*/*', 'content-type': 'application/json', origin: 'https://www.doordash.com', Cookie: session.cookies, ...(typeof session.providerConfig.ddAttKey === 'string' ? { 'dd-att-key': session.providerConfig.ddAttKey } : {}) }, body: JSON.stringify(body), cache: 'no-store' });
      if (!Array.isArray(payload?.orders)) throw new Error(`DoorDash ${mode} request failed`);
      return { provider, orders: payload.orders.map((order: any) => ({ orderId: order.orderId || '', workflowUuid: order.deliveryUuid || '', orderUuid: order.deliveryUuid || '', customerName: order.consumer?.informalName || order.consumer?.formalNameAbbreviated || 'Customer', salesTotal: order.orderValue?.displayString || '', netPayout: '', requestedAt: mode === 'scheduled' ? order.deliveryTime || order.pickupTime || order.completedTime || '' : order.completedTime || order.deliveryTime || order.pickupTime || '', courierName: order.dasher?.informalName || order.dasher?.formalNameAbbreviated || '', fulfillmentType: order.fulfillmentDetails?.fulfillmentType || '', issueType: order.orderStatusDisplay || '', orderChannel: order.orderSubStatus?.display || 'DoorDash', isSubscriber: false, subscriptionPass: '' })).filter((order: any) => order.orderId && order.workflowUuid), nextCursor: null };
    },
    async getOrderDetail(provider, workflowUuid, options = {}): Promise<MarketplaceOrderDetail> {
      const session = await input.getSession(provider);
      if (provider === 'doordash') {
        const storeId = Number(session.providerConfig.storeId);
        if (!storeId) throw new Error('DoorDash order detail request failed: missing storeId');
        const payload = await providerJson(transport, 'DoorDash', 'order detail', 'https://merchant-portal.doordash.com/merchant-analytics-service/api/v1/orders_details/', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', origin: 'https://www.doordash.com', Cookie: session.cookies, ...(typeof session.providerConfig.ddAttKey === 'string' ? { 'dd-att-key': session.providerConfig.ddAttKey } : {}) }, body: JSON.stringify({ country: 'AU', storeId, deliveryUuid: workflowUuid }), cache: 'no-store' });
        if (!payload?.data) throw new Error('DoorDash order detail request failed');
        return normalizeDoorDashDetail(payload.data, workflowUuid);
      }
      const restaurantUuid = restaurant(session.cookies), live = options.mode === 'live', key = live ? 'liveOrderDetails' : 'orderDetails';
      const query = `query OrderDetails($workflowUUID: String!) { ${key}(workflowUUID: $workflowUUID) { orderId orderUUID requestedAt completedAtTimestamp fulfillmentType netPayout eater { name phone deliveryAddress } courier { name phone } restaurant { name } items { name price quantity specialInstructions } } }`;
      const payload = await providerJson(transport, 'Uber Eats', 'order detail', `https://merchants.ubereats.com/manager/graphql?op=${live ? 'LiveOrderDetails' : 'OrderDetails'}`, { method: 'POST', headers: { accept: '*/*', 'content-type': 'application/json', origin: 'https://merchants.ubereats.com', 'x-csrf-token': 'x', Cookie: session.cookies }, body: JSON.stringify({ operationName: live ? 'LiveOrderDetails' : 'OrderDetails', variables: { workflowUUID: workflowUuid, detailsRequestedByRestaurantUUID: restaurantUuid }, query }), cache: 'no-store' });
      const detail = payload?.data?.[key];
      if (!detail) throw new Error('Uber Eats order detail request failed');
      return normalizeUberDetail(detail, workflowUuid);
    },
  };
}
