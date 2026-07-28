import type { Order } from '@my-small-business/types';
import { getScheduledPickupLeadMinutes, PRE_ORDER_LEAD_MINUTES } from '../utils/orderUtils';

type LiveOrderCandidate = Pick<Order, 'scheduled_pickup_at' | 'order_status' | 'payment_status'>;
const PREORDER_AUTOMATION_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

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

export function getScheduledOrderAutomationRange(nowMs: number = Date.now()): { from: string; until: string } {
  return {
    from: new Date(nowMs - PREORDER_AUTOMATION_LOOKBACK_MS).toISOString(),
    until: new Date(nowMs + PRE_ORDER_LEAD_MINUTES * 60 * 1000).toISOString(),
  };
}
