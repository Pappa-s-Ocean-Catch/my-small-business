import type { Order } from '@my-small-business/types';
import { getScheduledPickupLeadMinutes, PRE_ORDER_LEAD_MINUTES } from '../utils/orderUtils';

type LiveOrderCandidate = Pick<Order, 'scheduled_pickup_at' | 'order_status' | 'payment_status'>;
const PREORDER_AUTOMATION_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export type LiveOrderExclusionReason =
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'on_the_way'
  | 'pickup_outside_live_window';

export type LiveOrderEligibility = {
  isLive: boolean;
  reason: LiveOrderExclusionReason | null;
  leadMinutes: number | null;
};

export function isOnTheWayOrder(order: LiveOrderCandidate): boolean {
  return order.order_status === 'on_the_way' && order.payment_status !== 'refunded';
}

export function isLiveOrder(order: LiveOrderCandidate, nowMs: number = Date.now()): boolean {
  return getLiveOrderEligibility(order, nowMs).isLive;
}

export function getLiveOrderEligibility(
  order: LiveOrderCandidate,
  nowMs: number = Date.now(),
): LiveOrderEligibility {
  if (order.order_status === 'completed') {
    return { isLive: false, reason: 'completed', leadMinutes: null };
  }
  if (order.order_status === 'cancelled') {
    return { isLive: false, reason: 'cancelled', leadMinutes: null };
  }
  if (order.payment_status === 'refunded') {
    return { isLive: false, reason: 'refunded', leadMinutes: null };
  }
  if (isOnTheWayOrder(order)) {
    return { isLive: false, reason: 'on_the_way', leadMinutes: null };
  }

  const leadMinutes = getScheduledPickupLeadMinutes(order.scheduled_pickup_at, nowMs);
  if (leadMinutes != null && leadMinutes > PRE_ORDER_LEAD_MINUTES) {
    return { isLive: false, reason: 'pickup_outside_live_window', leadMinutes };
  }
  return { isLive: true, reason: null, leadMinutes };
}

export function getAutoPrintableLiveOrders(orders: Order[], nowMs: number = Date.now()): Order[] {
  return orders.filter((order) => (
    isLiveOrder(order, nowMs)
    && (order.order_status === 'pending' || order.order_status === 'confirmed')
    && order.payment_status !== 'refunded'
  ));
}

/**
 * Database range for the Live Orders source query. A preorder belongs in the
 * source set because of its pickup time, never because of when it was placed.
 */
export function getLiveOrderQueryRange(nowMs: number = Date.now()): { until: string } {
  return {
    until: new Date(nowMs + PRE_ORDER_LEAD_MINUTES * 60 * 1000).toISOString(),
  };
}

export function getScheduledOrderAutomationRange(nowMs: number = Date.now()): { from: string; until: string } {
  return {
    from: new Date(nowMs - PREORDER_AUTOMATION_LOOKBACK_MS).toISOString(),
    until: new Date(nowMs + PRE_ORDER_LEAD_MINUTES * 60 * 1000).toISOString(),
  };
}
