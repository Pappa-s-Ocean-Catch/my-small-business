import type { DesktopOrder } from './order-types';

export function isDesktopLiveOrder(order: DesktopOrder, nowMs: number = Date.now()): boolean {
  if (['completed', 'cancelled', 'on_the_way', 'pending_online_payment'].includes(order.order_status)) return false;
  if (order.payment_status === 'refunded') return false;
  return !order.scheduled_pickup_at || new Date(order.scheduled_pickup_at).getTime() <= nowMs + 30 * 60_000;
}

export function sortDesktopLiveOrders(orders: DesktopOrder[]): DesktopOrder[] {
  return [...orders].sort((left, right) => (
    new Date(left.scheduled_pickup_at ?? left.created_at).getTime() - new Date(right.scheduled_pickup_at ?? right.created_at).getTime()
  ));
}
