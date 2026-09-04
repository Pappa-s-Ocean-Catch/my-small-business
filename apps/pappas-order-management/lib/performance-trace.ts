export const PERFORMANCE_SLOW_OPERATION_MS = 500;

export function getTimerDelayMs(expectedAtMs: number, actualAtMs: number): number {
  return Math.max(0, actualAtMs - expectedAtMs);
}

export function isSlowOperation(
  durationMs: number,
  thresholdMs: number = PERFORMANCE_SLOW_OPERATION_MS
): boolean {
  return Number.isFinite(durationMs) && durationMs >= thresholdMs;
}

export function formatPerformanceDuration(durationMs: number): string {
  return `${Math.max(0, Math.round(durationMs))}ms`;
}
