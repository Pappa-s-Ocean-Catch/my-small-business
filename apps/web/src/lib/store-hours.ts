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

/** Check if a given time (minutes since midnight) is within open-close. Handles overnight (e.g. 22:00 - 02:00). */
function isTimeWithinRange(open: StoreHoursDay, minutes: number): boolean {
  const openMin = timeToMinutes(open.open);
  let closeMin = timeToMinutes(open.close);
  if (closeMin <= openMin) closeMin += 24 * 60; // next day
  const m = minutes >= openMin ? minutes : minutes + 24 * 60;
  return m >= openMin && m < closeMin;
}

/**
 * Returns whether the store is currently open according to store hours.
 * Uses optional timezone (default Australia/Melbourne).
 */
export function isStoreOpenNow(
  storeHours: StoreHours,
  timezone: string = DEFAULT_TZ
): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  let day = 0; // Sunday
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === 'weekday') {
      const w = p.value.toLowerCase();
      const days: Record<string, number> = {
        sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
      };
      day = days[w] ?? 0;
    }
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
  }
  const dayHours = storeHours[String(day)];
  if (!dayHours) return false;
  const minutes = hour * 60 + minute;
  return isTimeWithinRange(dayHours, minutes);
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
  options: { numDays?: number; intervalMinutes?: number; timezone?: string } = {}
): PickupDayOption[] {
  const { numDays = 7, intervalMinutes = 15, timezone = DEFAULT_TZ } = options;
  const result: PickupDayOption[] = [];
  const cursor = new Date(fromDate);
  cursor.setHours(0, 0, 0, 0);

  for (let d = 0; d < numDays; d++) {
    const day = cursor.getDay();
    const dayHours = storeHours[String(day)];
    if (!dayHours) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    const openMin = timeToMinutes(dayHours.open);
    let closeMin = timeToMinutes(dayHours.close);
    if (closeMin <= openMin) closeMin += 24 * 60;

    const slots: PickupSlot[] = [];
    for (let m = openMin; m < closeMin; m += intervalMinutes) {
      const h = Math.floor(m / 60) % 24;
      const min = m % 60;
      const slotDate = new Date(cursor);
      slotDate.setHours(h, min, 0, 0);
      const iso = slotDate.toISOString();
      const label = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      slots.push({ value: iso, label });
    }

    const dateStr = cursor.toISOString().slice(0, 10);
    const dateLabel = cursor.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: timezone,
    });
    result.push({ date: dateStr, dateLabel, slots });
    cursor.setDate(cursor.getDate() + 1);
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
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  let day = 0;
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === 'weekday') {
      const w = p.value.toLowerCase();
      const days: Record<string, number> = {
        sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
      };
      day = days[w] ?? 0;
    }
    if (p.type === 'hour') hour = parseInt(p.value, 10);
    if (p.type === 'minute') minute = parseInt(p.value, 10);
  }
  const dayHours = storeHours[String(day)];
  if (!dayHours) return false;
  const minutes = hour * 60 + minute;
  return isTimeWithinRange(dayHours, minutes);
}
