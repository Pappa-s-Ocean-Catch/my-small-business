import type { StoreHours, StoreHoursDay } from '@my-small-business/types';

const DEFAULT_OPEN = '10:00';
const DEFAULT_CLOSE = '21:00';
const DEFAULT_TZ = 'Australia/Melbourne';

/** Build StoreHours from single open/close (all days same). */
export function buildDefaultStoreHours(open: string, close: string): StoreHours {
  const day: StoreHoursDay = { open, close };
  const hours: StoreHours = {};
  for (let i = 0; i <= 6; i++) {
    hours[String(i)] = day;
  }
  return hours;
}

/** Parse "HH:mm" to minutes since midnight. */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Calendar fields in the store timezone, independent of browser/server timezone. */
function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

function localToDate(year: number, month: number, day: number, minutes: number, timezone: string): Date {
  const target = Date.UTC(year, month - 1, day, 0, minutes);
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const p = localParts(new Date(instant), timezone);
    instant += target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  return new Date(instant);
}

export function isStoreOpenNow(storeHours: StoreHours, timezone: string = DEFAULT_TZ): boolean {
  return isPickupTimeWithinHours(storeHours, new Date().toISOString(), timezone);
}

export interface PickupSlot {
  value: string; // ISO datetime
  label: string;
}

export interface PickupDayOption {
  date: string; // YYYY-MM-DD
  dateLabel: string;
  slots: PickupSlot[];
}

/**
 * Generate pickup time slots for the next `numDays` days (only open days),
 * with slots every `intervalMinutes` within each day's open window.
 */
export function getPickupTimeSlots(
  storeHours: StoreHours,
  fromDate: Date,
  options: { numDays?: number; intervalMinutes?: number; timezone?: string; startOffsetMinutes?: number } = {}
): PickupDayOption[] {
  const { numDays = 7, intervalMinutes = 15, timezone = DEFAULT_TZ, startOffsetMinutes = 0 } = options;
  const result: PickupDayOption[] = [];
  const local = localParts(fromDate, timezone);
  const cursor = new Date(Date.UTC(local.year, local.month - 1, local.day));

  // Include any remaining slots in the previous day's overnight window.
  for (let d = -1; d < numDays; d++) {
    const date = new Date(cursor);
    date.setUTCDate(date.getUTCDate() + d);
    const dayHours = storeHours[String(date.getUTCDay())];
    if (!dayHours) continue;
    const openMin = timeToMinutes(dayHours.open);
    let closeMin = timeToMinutes(dayHours.close);
    if (closeMin <= openMin) closeMin += 24 * 60;
    for (let m = openMin + startOffsetMinutes; m < closeMin; m += intervalMinutes) {
      const slotDate = localToDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), m, timezone);
      if (slotDate.getTime() <= fromDate.getTime()) continue;
      const p = localParts(slotDate, timezone);
      const dateStr = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
      const firstDate = cursor.toISOString().slice(0, 10);
      const lastDate = new Date(cursor.getTime() + (numDays - 1) * 86400000).toISOString().slice(0, 10);
      if (dateStr < firstDate || dateStr > lastDate) continue;
      let option = result.find(day => day.date === dateStr);
      if (!option) {
        option = { date: dateStr, dateLabel: slotDate.toLocaleDateString('en-AU', {
          weekday: 'short', day: 'numeric', month: 'short', timeZone: timezone,
        }), slots: [] };
        result.push(option);
      }
      const value = slotDate.toISOString();
      if (!option.slots.some(slot => slot.value === value)) {
        option.slots.push({ value, label: `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}` });
      }
    }
  }

  return result;
}

/**
 * Validate that a scheduled pickup datetime falls on an open day and within open hours.
 */
export function isPickupTimeWithinHours(
  storeHours: StoreHours,
  scheduledPickupAt: string,
  timezone: string = DEFAULT_TZ
): boolean {
  const d = new Date(scheduledPickupAt);
  if (!Number.isFinite(d.getTime())) return false;
  const p = localParts(d, timezone);
  const day = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  const minutes = p.hour * 60 + p.minute;
  const today = storeHours[String(day)];
  if (today) {
    const open = timeToMinutes(today.open);
    const close = timeToMinutes(today.close);
    if (close > open ? minutes >= open && minutes < close : minutes >= open) return true;
  }
  const previous = storeHours[String((day + 6) % 7)];
  return !!previous && timeToMinutes(previous.close) <= timeToMinutes(previous.open)
    && minutes < timeToMinutes(previous.close);
}

/** Customer delivery slots begin fifteen minutes after the store opens. */
export function getDeliveryTimeSlots(
  storeHours: StoreHours,
  fromDate: Date,
  options: { numDays?: number; intervalMinutes?: number; timezone?: string } = {}
): PickupDayOption[] {
  return getPickupTimeSlots(storeHours, fromDate, { ...options, startOffsetMinutes: 15 });
}

export function isDeliveryTimeWithinHours(storeHours: StoreHours, deliveryAt: string, timezone: string = DEFAULT_TZ): boolean {
  const timestamp = new Date(deliveryAt).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return isPickupTimeWithinHours(storeHours, deliveryAt, timezone)
    && isPickupTimeWithinHours(storeHours, new Date(timestamp - 15 * 60000).toISOString(), timezone);
}
