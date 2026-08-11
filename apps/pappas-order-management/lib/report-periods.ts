export type ReportDateRange = { start: string; end: string };

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

function addDays(value: string, amount: number): string {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + amount);
  return formatLocalDate(date);
}

export function clampRollingDays(value: number): number {
  return Math.min(180, Math.max(1, Math.trunc(Number.isFinite(value) ? value : 15)));
}

export function getRollingReportRanges(today: string, days: number): { current: ReportDateRange; compare: ReportDateRange } {
  const length = clampRollingDays(days);
  const currentEnd = addDays(today, -1);
  const currentStart = addDays(currentEnd, -(length - 1));
  const compareEnd = addDays(currentStart, -1);
  return { current: { start: currentStart, end: currentEnd }, compare: { start: addDays(compareEnd, -(length - 1)), end: compareEnd } };
}
