type OrderAnnouncementCandidate = {
  order_channel?: string | null;
  created_at?: string | null;
};

export function getOrderAnnouncementDelayMs(
  order: OrderAnnouncementCandidate,
  printerDelayMs: number,
  nowMs: number = Date.now(),
): number {
  if (order.order_channel === 'third_party') return printerDelayMs;

  const createdAtMs = new Date(order.created_at || '').getTime();
  return Number.isFinite(createdAtMs)
    ? Math.max(0, createdAtMs + printerDelayMs - nowMs)
    : printerDelayMs;
}
