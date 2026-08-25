import type { MarketplaceActiveOrder, MarketplaceHistoryResult, MarketplaceOrderDetail } from './contracts';

type UberRow = Record<string, any>;

function amount(value: unknown) {
  if (typeof value === 'string') { const number = Number(value.replace(/[^0-9.-]/g, '')); return Number.isFinite(number) ? number : null; }
  if (value && typeof value === 'object' && typeof (value as { unitAmount?: unknown }).unitAmount === 'number') return (value as { unitAmount: number }).unitAmount / 100;
  return null;
}

function timestamp(value: unknown) { if (typeof value === 'number') return value < 1_000_000_000_000 ? value * 1000 : value; if (typeof value === 'string') { const parsed = Date.parse(value); return Number.isNaN(parsed) ? 0 : parsed; } return 0; }

export function adaptUberActive(payload: { data?: { rows?: UberRow[]; orders?: UberRow[]; activeOrders?: UberRow[]; paginationResult?: { nextCursor?: string } } }) {
  const providerRows = payload.data?.rows || payload.data?.orders || payload.data?.activeOrders || [];
  const orders: MarketplaceActiveOrder[] = providerRows.map((order) => ({
    orderId: order.orderId || '', workflowUuid: order.workflowUuid || order.workflowUUID || '', orderUuid: order.orderUuid || order.orderUUID || '',
    customerName: order.eater?.name || order.customer?.name || 'Customer', salesTotal: order.salesTotal || '', requestedAt: order.requestedAt || '', courierName: order.courierName || '', fulfillmentType: order.fulfillmentType || '', orderChannel: order.orderChannel || '', status: order.orderTag || order.orderCategory || order.issueType || 'Active', statusDescription: order.deliveryTimeLocal || order.estimatedReadyTimeLocal || '',
  })).filter((order) => order.orderId && order.workflowUuid);
  return { orders, providerRows: providerRows.length, nextCursor: payload.data?.paginationResult?.nextCursor || null };
}

export function adaptUberHistory(payload: { data?: { orders?: UberRow[]; paginationResult?: { nextCursor?: string }; pagination?: { cursor?: string } } }): MarketplaceHistoryResult {
  const rows = payload.data?.orders || [];
  return { provider: 'uber_eats', orders: rows.map((order) => ({ orderId: order.orderId || '', workflowUuid: order.workflowUuid || order.workflowUUID || '', orderUuid: order.orderUuid || order.orderUUID || '', customerName: order.eater?.name || 'Customer', salesTotal: order.salesTotal || '', netPayout: order.netPayout || order.payout || order.restaurantPayout || '', requestedAt: order.requestedAt || '', courierName: order.courierName || '', fulfillmentType: order.fulfillmentType || '', issueType: order.issueType || '', orderChannel: order.orderChannel || '', isSubscriber: !!order.eater?.isEatsPassSubscriber, subscriptionPass: order.eater?.subscriptionPass || '' })).filter((order) => order.orderId && order.workflowUuid), nextCursor: payload.data?.paginationResult?.nextCursor || payload.data?.pagination?.cursor || null };
}

export function adaptUberScheduled(payload: { data?: { ordersV2?: { rows?: UberRow[]; paginationResult?: { nextCursor?: string } } } }): MarketplaceHistoryResult {
  const rows = payload.data?.ordersV2?.rows || [];
  return { provider: 'uber_eats', orders: rows.map((order) => ({ orderId: order.orderId || '', workflowUuid: order.workflowUuid || order.workflowUUID || '', orderUuid: order.orderUuid || order.orderUUID || '', customerName: order.eater?.name || 'Customer', salesTotal: order.salesTotal || '', netPayout: order.netPayout || order.payout || order.restaurantPayout || '', requestedAt: order.deliveryTimeLocal || order.requestedAt || '', courierName: order.courierName || '', fulfillmentType: order.fulfillmentType || '', issueType: order.issueType || order.orderStatus || 'Scheduled', orderChannel: order.orderChannel || '', isSubscriber: !!order.eater?.isEatsPassSubscriber, subscriptionPass: order.eater?.subscriptionPass || '' })).filter((order) => order.orderId && order.workflowUuid), nextCursor: payload.data?.ordersV2?.paginationResult?.nextCursor || null };
}

export function adaptUberDetail(detail: UberRow, workflowUuid: string): MarketplaceOrderDetail {
  const items = (detail.items || []).map((item: UberRow) => ({ name: item.name || 'Item', price: item.price || '', quantity: item.quantity || 1, specialInstructions: item.specialInstructions || '', customizations: (item.customizations || []).map((group: UberRow) => ({ name: group.name || 'Options', options: (group.options || []).map((option: UberRow) => ({ name: option.name || 'Option', quantity: option.quantity || 1, price: option.price ?? null })) })) }));
  const checkoutInfo: Array<{ key: string; amount: unknown; label: string }> = (detail.checkoutInfo || []).map((entry: UberRow) => ({ key: entry.key || '', amount: entry.amount || '', label: entry.label || '' }));
  const subtotal = checkoutInfo.find((entry) => entry.key.toLowerCase().includes('subtotal'))?.amount ?? null;
  const discountEntries = checkoutInfo.filter((entry: { key: string; amount: unknown; label: string }) => { const value = amount(entry.amount); const key = entry.key.toLowerCase(); const label = entry.label.toLowerCase(); return value != null && value < 0 && !key.includes('fee') && !label.includes('fee') && (key.includes('promo') || key.includes('discount') || key.includes('merchantfunded') || label.includes('promo') || label.includes('discount')); });
  const discountAmount = discountEntries.reduce((sum: number, entry: { key: string; amount: unknown; label: string }) => sum + Math.abs(amount(entry.amount) || 0), 0);
  const subtotalAmount = amount(subtotal);
  const totalAmount = subtotalAmount == null ? null : Math.max(0, Math.round((subtotalAmount - discountAmount) * 100) / 100);
  return { provider: 'uber_eats', sourceName: 'Uber Eats', workflowUuid, orderId: detail.orderId || '', orderUUID: detail.orderUUID || '', requestedAt: timestamp(detail.requestedAt), completedAtTimestamp: detail.completedAtTimestamp ? timestamp(detail.completedAtTimestamp) : null, customerName: detail.eater?.name || 'Customer', customerPhone: detail.eater?.phone ?? null, customerAddress: detail.eater?.deliveryAddress ?? null, courierName: detail.courier?.name ?? null, courierPhone: detail.courier?.phone ?? null, restaurantName: detail.restaurant?.name || 'Restaurant', subtotal, subtotalAmount, discountLabel: discountEntries[0]?.key || null, discount: discountAmount > 0 ? `A$${discountAmount.toFixed(2)}` : null, discountAmount, total: totalAmount == null ? null : `A$${totalAmount.toFixed(2)}`, totalAmount, netPayout: detail.netPayout || '', marketplaceFeeRate: detail.marketplaceFeeRate ?? null, fulfillmentType: detail.fulfillmentType || '', orderJobState: detail.orderJobState ?? detail.issueSummary?.orderJobState ?? detail.issueSummaryV2?.orderJobState ?? null, statusDescription: detail.statusDescription ?? detail.issueSummary?.failureReason ?? detail.issueSummary?.issueType ?? detail.issueSummaryV2?.statusDescription ?? null, checkoutInfo, orderStateChanges: (detail.orderStateChanges || []).map((entry: UberRow) => ({ changedAt: timestamp(entry.changedAt), orderState: entry.orderState || '' })), items };
}
