import { formatDateInMelbourne, getTimeInMelbourne } from './report-timezone';

/** Fractional index in the daily report's half-hour buckets, using the store timezone. */
export function getDailyReportNowMarker(reportDate: string | undefined, now: Date, startHour: number, endHour: number) {
  if (!reportDate || reportDate !== formatDateInMelbourne(now)) return null;
  const { hour, minute } = getTimeInMelbourne(now);
  const minutes = hour * 60 + minute;
  if (minutes < startHour * 60 || minutes > endHour * 60) return null;
  return {
    index: (minutes - startHour * 60) / 30,
    label: `Now · ${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'pm' : 'am'}`,
  };
}
