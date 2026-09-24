import { formatDateInMelbourne, toMelbourneRangeBoundaryIso } from './report-timezone';

export const TOP_SELLERS_LIMIT = 12;

export type TopSellerSaleRow = {
  productId: string | null;
  quantity: number | null;
  orderId: string | null;
  orderStatus: string | null;
};

export type RankedTopSeller = {
  productId: string;
  quantitySold: number;
  orderCount: number;
};

export function rankTopSellers(rows: TopSellerSaleRow[]): RankedTopSeller[] {
  const salesByProduct = new Map<string, { quantitySold: number; orderIds: Set<string> }>();

  for (const row of rows) {
    if (!row.productId || row.orderStatus === 'cancelled') continue;

    const current = salesByProduct.get(row.productId) || { quantitySold: 0, orderIds: new Set<string>() };
    current.quantitySold += Number(row.quantity || 1);
    if (row.orderId) current.orderIds.add(row.orderId);
    salesByProduct.set(row.productId, current);
  }

  return Array.from(salesByProduct.entries())
    .map(([productId, sales]) => ({
      productId,
      quantitySold: sales.quantitySold,
      orderCount: sales.orderIds.size,
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold || a.productId.localeCompare(b.productId))
    .slice(0, TOP_SELLERS_LIMIT);
}

export function getMelbourneTodayRange(now: Date): { startIso: string; endIso: string } {
  const today = formatDateInMelbourne(now);
  const [year, month, day] = today.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const tomorrowDate = `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrow.getUTCDate()).padStart(2, '0')}`;

  return {
    startIso: toMelbourneRangeBoundaryIso(today, 'start'),
    endIso: toMelbourneRangeBoundaryIso(tomorrowDate, 'start'),
  };
}
