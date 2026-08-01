type RemovableIngredient = {
  name: string;
  customerCanRemove: boolean;
};

type MarketplaceReportOrder = {
  order_channel: string;
  delivery_partner_name: string | null;
  payment_status: string;
  order_status: string;
  total: number;
  marketplace_gross_sales: number | null;
  marketplace_gross_payout: number | null;
};

type ChannelFinancialBreakdown = {
  label: 'Store' | 'Uber Eats' | 'DoorDash';
  orders: number;
  grossSales: number;
  grossPayout: number | null;
  commission: number | null;
  netSales: number | null;
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeMarketplaceName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function getMarketplaceRemovalCandidate(optionName: string): string | null {
  const match = normalizeMarketplaceName(optionName).match(/^(?:no|without)\s+(.+)$/);
  return match?.[1] ?? null;
}

export function findRemovableIngredientName(
  optionName: string,
  ingredients: RemovableIngredient[]
): string | null {
  const target = getMarketplaceRemovalCandidate(optionName);
  if (!target) return null;

  return (
    ingredients.find(
      (item) => item.customerCanRemove && normalizeMarketplaceName(item.name) === target
    )?.name ?? null
  );
}

export function getMarketplaceOrderStatus(
  marketplaceState: string | null | undefined,
  statusDescription: string | null | undefined
): 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled' | 'refunded' {
  const status = normalizeMarketplaceName(`${marketplaceState ?? ''} ${statusDescription ?? ''}`);

  if (status.includes('refund')) return 'refunded';
  if (status.includes('cancel')) return 'cancelled';
  if (status.includes('complete') || status.includes('deliver')) return 'completed';
  if (status.includes('ready')) return 'ready';
  if (status.includes('prepar')) return 'preparing';

  return 'confirmed';
}

export function isMarketplaceImportDuplicateError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as { code?: unknown; message?: unknown };
  return (
    candidate.code === '23505' &&
    typeof candidate.message === 'string' &&
    candidate.message.includes('orders_unique_marketplace_import')
  );
}

export function isMarketplaceSalesOrder(order: MarketplaceReportOrder): boolean {
  return (
    order.payment_status === 'paid' &&
    order.order_status !== 'cancelled' &&
    order.order_status !== 'refunded'
  );
}

export function getOrderGrossSales(order: MarketplaceReportOrder): number {
  if (order.order_channel === 'third_party') {
    return order.marketplace_gross_sales ?? order.total;
  }

  return order.total;
}

function createChannel(label: ChannelFinancialBreakdown['label']): ChannelFinancialBreakdown {
  return {
    label,
    orders: 0,
    grossSales: 0,
    grossPayout: label === 'Store' ? null : 0,
    commission: label === 'Store' ? null : 0,
    netSales: label === 'Store' ? 0 : 0,
  };
}

function getMarketplaceChannel(order: MarketplaceReportOrder): ChannelFinancialBreakdown['label'] | null {
  if (order.order_channel !== 'third_party') return 'Store';

  const partner = normalizeMarketplaceName(order.delivery_partner_name ?? '');
  if (partner === 'uber eats') return 'Uber Eats';
  if (partner === 'doordash' || partner === 'door dash') return 'DoorDash';

  return null;
}

export function buildChannelFinancialBreakdown(
  orders: MarketplaceReportOrder[]
): ChannelFinancialBreakdown[] {
  const channels = new Map<ChannelFinancialBreakdown['label'], ChannelFinancialBreakdown>([
    ['Store', createChannel('Store')],
    ['Uber Eats', createChannel('Uber Eats')],
    ['DoorDash', createChannel('DoorDash')],
  ]);

  for (const order of orders) {
    if (!isMarketplaceSalesOrder(order)) continue;

    const label = getMarketplaceChannel(order);
    if (!label) continue;

    const channel = channels.get(label)!;
    const grossSales = getOrderGrossSales(order);
    channel.orders += 1;
    channel.grossSales = roundCurrency(channel.grossSales + grossSales);

    if (label === 'Store') {
      channel.netSales = roundCurrency(channel.grossSales * 0.9);
      continue;
    }

    if (order.marketplace_gross_payout == null) {
      channel.grossPayout = null;
      channel.commission = null;
      channel.netSales = null;
      continue;
    }

    if (channel.grossPayout == null || channel.commission == null || channel.netSales == null) continue;

    channel.grossPayout = roundCurrency(channel.grossPayout + order.marketplace_gross_payout);
    channel.commission = roundCurrency(channel.grossSales - channel.grossPayout);
    channel.netSales = roundCurrency(channel.grossPayout * 0.9);
  }

  return Array.from(channels.values());
}
