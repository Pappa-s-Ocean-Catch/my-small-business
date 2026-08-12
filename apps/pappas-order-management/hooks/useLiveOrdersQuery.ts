import { useQuery } from '@tanstack/react-query';
import { getAllOrders } from '@/lib/orders';
import type { Order } from '@my-small-business/types';
import { isScheduledPreOrder } from '@/utils/orderUtils';
import {
  getLiveOrderEligibility,
  getLiveOrderQueryRange,
  getScheduledOrderAutomationRange,
  isLiveOrder,
  isOnTheWayOrder,
} from '@/lib/live-order-window';

export const LIVE_ORDERS_QUERY_KEY = ['live-orders'] as const;
export const ON_THE_WAY_ORDERS_QUERY_KEY = ['on-the-way-orders'] as const;
export const PRE_ORDER_COUNT_QUERY_KEY = ['live-orders', 'pre-order-count'] as const;
export const PRE_ORDERS_QUERY_KEY = ['pre-orders'] as const;
const LIVE_ORDER_ELIGIBILITY_REFRESH_MS = 30_000;

export type LiveOrderFetchDiagnostics = {
  deviceNow: string;
  sourcePickupUntil: string;
  fetchedCount: number;
  liveCount: number;
  orders: Array<{
    id: string;
    orderNumber: string;
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

function isPreOrder(order: Order): boolean {
  return isScheduledPreOrder(order);
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
  const result = await getAllOrders({
    live_pickup_until: range.until,
  });

  if (result.error) {
    throw new Error(result.error);
  }

  const candidates = result.data || [];
  const decisions = candidates.map((order) => ({ order, eligibility: getLiveOrderEligibility(order, nowMs) }));
  const orders = sortLiveOrders(decisions
    .filter(({ eligibility }) => eligibility.isLive)
    .map(({ order }) => order));

  return {
    orders,
    diagnostics: {
      deviceNow: new Date(nowMs).toISOString(),
      sourcePickupUntil: range.until,
      fetchedCount: candidates.length,
      liveCount: orders.length,
      orders: decisions.slice(0, 100).map(({ order, eligibility }) => ({
        id: order.id,
        orderNumber: order.order_number,
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
  const result = await getAllOrders({ status: 'on_the_way' });

  if (result.error) {
    throw new Error(result.error);
  }

  return sortLiveOrders((result.data || []).filter(isOnTheWayOrder));
}

export async function fetchScheduledOrdersInAutomationWindow(nowMs: number = Date.now()): Promise<Order[]> {
  const range = getScheduledOrderAutomationRange(nowMs);
  const result = await getAllOrders({
    scheduled_pickup_since: range.from,
    scheduled_pickup_until: range.until,
  });

  if (result.error) {
    throw new Error(result.error);
  }

  return sortLiveOrders((result.data || []).filter((order) => isLiveOrder(order, nowMs)));
}

export async function fetchPreOrderCount(): Promise<number> {
  const result = await getAllOrders();
  if (result.error) {
    throw new Error(result.error);
  }
  return (result.data || []).filter(isPreOrder).length;
}

export async function fetchPreOrders(): Promise<Order[]> {
  const result = await getAllOrders();

  if (result.error) {
    throw new Error(result.error);
  }

  return sortPreOrders((result.data || []).filter(isPreOrder));
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
