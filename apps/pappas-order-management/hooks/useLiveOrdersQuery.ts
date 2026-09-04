import { useQuery } from '@tanstack/react-query';
import { getOpenOrderCandidates, getOrdersByIds } from '@/lib/orders';
import type { Order } from '@my-small-business/types';
import {
  getLiveOrderEligibility,
  getLiveOrderQueryRange,
} from '@/lib/live-order-window';
import {
  getAutoPrintableScheduledOrderCandidateIds,
  getLiveOrderCandidateIds,
  getOnTheWayOrderCandidateIds,
  getPreOrderCandidateIds,
} from '@/lib/open-order-candidates';
import { formatPerformanceDuration, isSlowOperation } from '@/lib/performance-trace';
import { usePrinterAutomationStore } from '@/stores/printerAutomationStore';

export const LIVE_ORDERS_QUERY_KEY = ['live-orders'] as const;
export const ON_THE_WAY_ORDERS_QUERY_KEY = ['on-the-way-orders'] as const;
export const PRE_ORDER_COUNT_QUERY_KEY = ['live-orders', 'pre-order-count'] as const;
export const PRE_ORDERS_QUERY_KEY = ['pre-orders'] as const;
const LIVE_ORDER_ELIGIBILITY_REFRESH_MS = 30_000;

export type LiveOrderFetchDiagnostics = {
  deviceNow: string;
  sourcePickupUntil: string;
  fetchedCount: number;
  hydratedCount: number;
  liveCount: number;
  orders: Array<{
    id: string;
    status: Order['order_status'];
    paymentStatus: Order['payment_status'];
    scheduledPickupAt: string | null;
    isLive: boolean;
    exclusionReason: string | null;
    leadMinutes: number | null;
  }>;
};

function sortLiveOrders(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    const timeA = new Date(a.scheduled_pickup_at || a.created_at).getTime();
    const timeB = new Date(b.scheduled_pickup_at || b.created_at).getTime();
    return timeA - timeB;
  });
}

function sortPreOrders(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    const timeA = new Date(a.scheduled_pickup_at || a.created_at).getTime();
    const timeB = new Date(b.scheduled_pickup_at || b.created_at).getTime();
    return timeA - timeB;
  });
}

async function fetchLiveOrderResult(nowMs: number = Date.now()): Promise<{
  orders: Order[];
  diagnostics: LiveOrderFetchDiagnostics;
}> {
  const range = getLiveOrderQueryRange(nowMs);
  const candidateStartedAt = Date.now();
  const result = await getOpenOrderCandidates(nowMs);

  if (result.error) {
    throw new Error(result.error);
  }

  const candidates = result.data || [];
  const decisions = candidates.map((order) => ({ order, eligibility: getLiveOrderEligibility(order, nowMs) }));
  const liveOrderIds = getLiveOrderCandidateIds(candidates, nowMs);
  const hydrationStartedAt = Date.now();
  const hydrated = await getOrdersByIds(liveOrderIds);
  if (hydrated.error) throw new Error(hydrated.error);
  const orders = sortLiveOrders(hydrated.data || []);

  console.info('[live-orders-query]', {
    candidateDurationMs: hydrationStartedAt - candidateStartedAt,
    hydrationDurationMs: Date.now() - hydrationStartedAt,
    candidateCount: candidates.length,
    eligibleCount: liveOrderIds.length,
    hydratedCount: orders.length,
  });

  const candidateDurationMs = hydrationStartedAt - candidateStartedAt;
  const hydrationDurationMs = Date.now() - hydrationStartedAt;
  const totalDurationMs = candidateDurationMs + hydrationDurationMs;
  if (isSlowOperation(totalDurationMs)) {
    usePrinterAutomationStore.getState().addJournalEntry({
      level: 'decision',
      scope: 'performance',
      message: 'Live Orders reload was slow',
      details: [
        `total=${formatPerformanceDuration(totalDurationMs)}`,
        `candidate=${formatPerformanceDuration(candidateDurationMs)}`,
        `hydrate=${formatPerformanceDuration(hydrationDurationMs)}`,
        `candidates=${candidates.length}`,
        `eligible=${liveOrderIds.length}`,
        `hydrated=${orders.length}`,
      ].join(' '),
    });
  }

  return {
    orders,
    diagnostics: {
      deviceNow: new Date(nowMs).toISOString(),
      sourcePickupUntil: range.until,
      fetchedCount: candidates.length,
      hydratedCount: orders.length,
      liveCount: orders.length,
      orders: decisions.slice(0, 100).map(({ order, eligibility }) => ({
        id: order.id,
        status: order.order_status,
        paymentStatus: order.payment_status,
        scheduledPickupAt: order.scheduled_pickup_at,
        isLive: eligibility.isLive,
        exclusionReason: eligibility.reason,
        leadMinutes: eligibility.leadMinutes,
      })),
    },
  };
}

export async function fetchLiveOrders(): Promise<Order[]> {
  return (await fetchLiveOrderResult()).orders;
}

export async function fetchLiveOrderDiagnostics(): Promise<LiveOrderFetchDiagnostics> {
  return (await fetchLiveOrderResult()).diagnostics;
}

export async function fetchOnTheWayOrders(): Promise<Order[]> {
  const result = await getOpenOrderCandidates();

  if (result.error) {
    throw new Error(result.error);
  }

  const hydrated = await getOrdersByIds(getOnTheWayOrderCandidateIds(result.data || []));
  if (hydrated.error) throw new Error(hydrated.error);
  return sortLiveOrders(hydrated.data || []);
}

export async function fetchScheduledOrdersInAutomationWindow(nowMs: number = Date.now()): Promise<Order[]> {
  const result = await getOpenOrderCandidates(nowMs);

  if (result.error) {
    throw new Error(result.error);
  }

  const hydrated = await getOrdersByIds(getAutoPrintableScheduledOrderCandidateIds(result.data || [], nowMs));
  if (hydrated.error) throw new Error(hydrated.error);
  return sortLiveOrders(hydrated.data || []);
}

async function fetchPreOrderCountAt(nowMs: number): Promise<number> {
  const result = await getOpenOrderCandidates(nowMs);
  if (result.error) {
    throw new Error(result.error);
  }
  return getPreOrderCandidateIds(result.data || [], nowMs).length;
}

export async function fetchPreOrderCount(): Promise<number> {
  return fetchPreOrderCountAt(Date.now());
}

async function fetchPreOrdersAt(nowMs: number): Promise<Order[]> {
  const result = await getOpenOrderCandidates(nowMs);

  if (result.error) {
    throw new Error(result.error);
  }

  const hydrated = await getOrdersByIds(getPreOrderCandidateIds(result.data || [], nowMs));
  if (hydrated.error) throw new Error(hydrated.error);
  return sortPreOrders(hydrated.data || []);
}

export async function fetchPreOrders(): Promise<Order[]> {
  return fetchPreOrdersAt(Date.now());
}

export function useLiveOrdersQuery() {
  return useQuery({
    queryKey: LIVE_ORDERS_QUERY_KEY,
    queryFn: fetchLiveOrders,
    // Pickup eligibility changes as time passes, even when a database event is delayed or missed.
    refetchInterval: LIVE_ORDER_ELIGIBILITY_REFRESH_MS,
  });
}

export function useOnTheWayOrdersQuery() {
  return useQuery({
    queryKey: ON_THE_WAY_ORDERS_QUERY_KEY,
    queryFn: fetchOnTheWayOrders,
  });
}

export function usePreOrderCountQuery() {
  return useQuery({
    queryKey: PRE_ORDER_COUNT_QUERY_KEY,
    queryFn: fetchPreOrderCount,
  });
}

export function usePreOrdersQuery() {
  return useQuery({
    queryKey: PRE_ORDERS_QUERY_KEY,
    queryFn: fetchPreOrders,
  });
}
