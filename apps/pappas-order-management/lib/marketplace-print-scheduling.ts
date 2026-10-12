type OrderAnnouncementCandidate = {
  order_channel?: string | null;
  created_at?: string | null;
};

export function getOrderAnnouncementDelayMs(
  order: OrderAnnouncementCandidate,
  printerDelayMs: number,
  nowMs: number = Date.now(),
  instoreOrderAutoPrintEnabled: boolean = true,
): number | null {
  if (order.order_channel === 'instore' && !instoreOrderAutoPrintEnabled) return null;
  if (order.order_channel === 'third_party') return printerDelayMs;

  const createdAtMs = new Date(order.created_at || '').getTime();
  return Number.isFinite(createdAtMs)
    ? Math.max(0, createdAtMs + printerDelayMs - nowMs)
    : printerDelayMs;
}

/** Convert the configured order delay without replacing an explicit zero. */
export function getPrintDelayMs(seconds: number = 3): number {
  return Math.min(120, Math.max(0, Number.isFinite(seconds) ? seconds : 3)) * 1000;
}

/** Give another tablet a head start before competing for the database claim. */
export function waitForPrintClaimDelay(seconds: number = 0): Promise<void> {
  const delayMs = getPrintDelayMs(Number.isFinite(seconds) ? seconds : 0);
  return delayMs > 0
    ? new Promise((resolve) => setTimeout(resolve, delayMs))
    : Promise.resolve();
}
