export type ReportDateRange = {
  start: string;
  end: string;
};

export type ReportDailyBreakdownRow = {
  label: string;
  orders: number;
  total: number;
};

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDay(value: string): string {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + 1);
  return formatLocalDate(date);
}

export function buildDailyReportBreakdown<T>({
  range,
  orders,
  getDayKey,
  getTotal,
  formatLabel,
}: {
  range: ReportDateRange;
  orders: T[];
  getDayKey: (order: T) => string;
  getTotal: (order: T) => number;
  formatLabel: (date: string) => string;
}): ReportDailyBreakdownRow[] {
  const rowsByDate = new Map<string, ReportDailyBreakdownRow>();

  for (let date = range.start; date <= range.end; date = addDay(date)) {
    rowsByDate.set(date, { label: formatLabel(date), orders: 0, total: 0 });
  }

  for (const order of orders) {
    const date = getDayKey(order);
    const row = rowsByDate.get(date);
    if (!row) continue;
    row.orders += 1;
    row.total += Number(getTotal(order)) || 0;
  }

  return Array.from(rowsByDate.values());
}
