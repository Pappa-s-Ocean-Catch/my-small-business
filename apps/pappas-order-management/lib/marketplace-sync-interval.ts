export const DEFAULT_MARKETPLACE_SYNC_INTERVAL_SEC = 30;
export const MIN_MARKETPLACE_SYNC_INTERVAL_SEC = 15;
export const MAX_MARKETPLACE_SYNC_INTERVAL_SEC = 600;

export function normalizeMarketplaceSyncIntervalSec(value: unknown): number {
  const numericValue = typeof value === 'number' && Number.isFinite(value)
    ? Math.trunc(value)
    : DEFAULT_MARKETPLACE_SYNC_INTERVAL_SEC;

  return Math.min(
    MAX_MARKETPLACE_SYNC_INTERVAL_SEC,
    Math.max(MIN_MARKETPLACE_SYNC_INTERVAL_SEC, numericValue)
  );
}
