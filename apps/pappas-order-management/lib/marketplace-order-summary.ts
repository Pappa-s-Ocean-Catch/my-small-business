function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

type MarketplaceSummaryInput = {
  items: Array<{ price: string }>;
  subtotalAmount?: number | null;
  totalAmount?: number | null;
  discountAmount?: number;
};

export function parseMarketplaceMoney(value?: string | null): number | null {
  if (!value) return null;
  const normalized = value.replace(/[^0-9.-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? roundCurrency(parsed) : null;
}

export function getMarketplaceItemsTotal(detail: Pick<MarketplaceSummaryInput, 'items'>): number {
  return roundCurrency(
    (detail.items || []).reduce((sum, item) => sum + (parseMarketplaceMoney(item.price) || 0), 0)
  );
}

export function getMarketplaceImportDiscountAmount(
  detail: MarketplaceSummaryInput
): number {
  const discountAmount = roundCurrency(detail.discountAmount || 0);
  if (discountAmount <= 0) return 0;

  const itemsTotal = getMarketplaceItemsTotal(detail);
  const subtotalAmount = detail.subtotalAmount == null ? null : roundCurrency(detail.subtotalAmount);
  const totalAmount = detail.totalAmount == null ? null : roundCurrency(detail.totalAmount);

  if (totalAmount != null && Math.abs(itemsTotal - totalAmount) <= 0.01) {
    return 0;
  }

  if (subtotalAmount != null && Math.abs(itemsTotal - subtotalAmount) <= 0.01) {
    return discountAmount;
  }

  if (totalAmount != null && itemsTotal - totalAmount > 0.01) {
    return Math.min(discountAmount, roundCurrency(itemsTotal - totalAmount));
  }

  return 0;
}
