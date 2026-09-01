import type { Order } from '@my-small-business/types';

import {
  getLiveOrderEligibility,
  getScheduledOrderAutomationRange,
} from './live-order-window';
import { isScheduledPreOrder } from '../utils/orderUtils';

const OPEN_ORDER_LOOKBACK_DAYS = 14;

export type OpenOrderCandidate = Pick<
  Order,
  'id' | 'created_at' | 'scheduled_pickup_at' | 'order_status' | 'payment_status'
>;

export function getOpenOrderCandidateRange(nowMs: number = Date.now()): { since: string } {
  return {
    since: new Date(nowMs - OPEN_ORDER_LOOKBACK_DAYS * 24 * 60 * 60 * 1_000).toISOString(),
  };
}

export function isOpenOrderCandidate(order: OpenOrderCandidate): boolean {
  return order.order_status !== 'completed'
    && order.order_status !== 'cancelled'
    && order.order_status !== 'refunded'
    && order.order_status !== 'pending_online_payment'
    && order.payment_status !== 'refunded';
}

export function getLiveOrderCandidateIds(
  candidates: OpenOrderCandidate[],
  nowMs: number = Date.now(),
): string[] {
  return candidates
    .filter((order) => isOpenOrderCandidate(order) && getLiveOrderEligibility(order, nowMs).isLive)
    .map((order) => order.id);
}

export function getPreOrderCandidateIds(
  candidates: OpenOrderCandidate[],
  nowMs: number = Date.now(),
): string[] {
  return candidates
    .filter((order) => isOpenOrderCandidate(order) && isScheduledPreOrder(order, nowMs))
    .map((order) => order.id);
}

export function getOnTheWayOrderCandidateIds(candidates: OpenOrderCandidate[]): string[] {
  return candidates
    .filter((order) => isOpenOrderCandidate(order) && order.order_status === 'on_the_way')
    .map((order) => order.id);
}

export function getUniqueOrderIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

export function getAutoPrintableScheduledOrderCandidateIds(
  candidates: OpenOrderCandidate[],
  nowMs: number = Date.now(),
): string[] {
  const range = getScheduledOrderAutomationRange(nowMs);
  const fromMs = new Date(range.from).getTime();
  const untilMs = new Date(range.until).getTime();

  return candidates
    .filter((order) => {
      if (!isOpenOrderCandidate(order) || !order.scheduled_pickup_at) return false;
      const pickupMs = new Date(order.scheduled_pickup_at).getTime();
      return Number.isFinite(pickupMs)
        && pickupMs >= fromMs
        && pickupMs <= untilMs
        && getLiveOrderEligibility(order, nowMs).isLive
        && (order.order_status === 'pending' || order.order_status === 'confirmed');
    })
    .map((order) => order.id);
}
