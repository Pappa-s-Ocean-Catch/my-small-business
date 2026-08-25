export const DEFAULT_MARKETPLACE_SYNC_START_TIME = '11:00';
export const DEFAULT_MARKETPLACE_SYNC_END_TIME = '20:30';

export type MarketplaceSyncWindow = {
  startTime: string;
  endTime: string;
};

function isTime(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function minutesSinceMidnight(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function normalizeMarketplaceSyncWindow(value: Partial<MarketplaceSyncWindow> | null | undefined): MarketplaceSyncWindow {
  const startTime = isTime(value?.startTime) ? value.startTime : DEFAULT_MARKETPLACE_SYNC_START_TIME;
  const endTime = isTime(value?.endTime) ? value.endTime : DEFAULT_MARKETPLACE_SYNC_END_TIME;
  return minutesSinceMidnight(startTime) < minutesSinceMidnight(endTime)
    ? { startTime, endTime }
    : { startTime: DEFAULT_MARKETPLACE_SYNC_START_TIME, endTime: DEFAULT_MARKETPLACE_SYNC_END_TIME };
}

export function isMarketplaceSyncTimeOpen(currentTime: string, window: MarketplaceSyncWindow) {
  const current = minutesSinceMidnight(currentTime);
  return current >= minutesSinceMidnight(window.startTime) && current < minutesSinceMidnight(window.endTime);
}
