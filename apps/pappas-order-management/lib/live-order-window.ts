import type { Order } from '@my-small-business/types';
import { getScheduledPickupLeadMinutes, PRE_ORDER_LEAD_MINUTES } from '../utils/orderUtils';

type LiveOrderCandidate = Pick<Order, 'scheduled_pickup_at' | 'order_status' | 'payment_status'>;

function isClosedOrRefunded(order: LiveOrderCandidate): boolean {
  return order.order_status === 'completed'
    || order.order_status === 'cancelled'
    || order.payment_status === 'refunded';
}

export function isLiveOrder(order: LiveOrderCandidate, nowMs: number = Date.now()): boolean {
  if (isClosedOrRefunded(order)) return false;

  const leadMinutes = getScheduledPickupLeadMinutes(order.scheduled_pickup_at, nowMs);
  return leadMinutes == null || leadMinutes <= PRE_ORDER_LEAD_MINUTES;
}

export function getAutoPrintableLiveOrders(orders: Order[], nowMs: number = Date.now()): Order[] {
  return orders.filter((order) => (
    isLiveOrder(order, nowMs)
    && (order.order_status === 'pending' || order.order_status === 'confirmed')
    && order.payment_status !== 'refunded'
  ));
}
