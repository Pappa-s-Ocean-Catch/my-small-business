export const TODAY_TOP_SELLERS_LIMIT = 12;

export type TodayTopSellerSaleRow = {
  productId: string | null;
  quantity: number | null;
  orderId: string | null;
  orderStatus: string | null;
};

export type RankedTodayTopSeller = {
  productId: string;
  quantitySold: number;
  orderCount: number;
};

type MelbourneDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getMelbourneDateTimeParts(date: Date): MelbourneDateTimeParts {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function getMelbourneOffsetMilliseconds(instant: Date): number {
  const parts = getMelbourneDateTimeParts(instant);
  const wholeSecondInstant = Math.floor(instant.getTime() / 1_000) * 1_000;
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - wholeSecondInstant;
}

function melbourneMidnightIso(year: number, month: number, day: number): string {
  const wallClockMilliseconds = Date.UTC(year, month - 1, day);
  let utcMilliseconds = wallClockMilliseconds;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    utcMilliseconds = wallClockMilliseconds - getMelbourneOffsetMilliseconds(new Date(utcMilliseconds));
  }

  return new Date(utcMilliseconds).toISOString();
}

export function getMelbourneTodayRange(now: Date): { startIso: string; endIso: string } {
  const today = getMelbourneDateTimeParts(now);
  const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));

  return {
    startIso: melbourneMidnightIso(today.year, today.month, today.day),
    endIso: melbourneMidnightIso(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate()),
  };
}

export function rankTodayTopSellers(rows: TodayTopSellerSaleRow[]): RankedTodayTopSeller[] {
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
    .slice(0, TODAY_TOP_SELLERS_LIMIT);
}
