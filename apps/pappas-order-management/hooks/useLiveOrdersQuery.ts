import { useQuery } from '@tanstack/react-query';
import { getAllOrders } from '@/lib/orders';
import type { Order } from '@my-small-business/types';
import { getScheduledPickupLeadMinutes, isScheduledPreOrder, PRE_ORDER_LEAD_MINUTES } from '@/utils/orderUtils';

export const LIVE_ORDERS_QUERY_KEY = ['live-orders'] as const;
export const PRE_ORDER_COUNT_QUERY_KEY = ['live-orders', 'pre-order-count'] as const;
export const PRE_ORDERS_QUERY_KEY = ['pre-orders'] as const;

function isLiveOrder(order: Order): boolean {
  const isNotFinished =
    order.order_status !== 'completed'
    && order.order_status !== 'cancelled'
    && order.payment_status !== 'refunded';

  if (!isNotFinished) return false;
  const diffMinutes = getScheduledPickupLeadMinutes(order.scheduled_pickup_at);
  return diffMinutes == null || diffMinutes <= PRE_ORDER_LEAD_MINUTES;
}

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

export async function fetchLiveOrders(): Promise<Order[]> {
  const since = new Date();
  since.setHours(since.getHours() - 24);

  const result = await getAllOrders({
    since: since.toISOString(),
  });

  if (result.error) {
    throw new Error(result.error);
  }

  return sortLiveOrders((result.data || []).filter(isLiveOrder));
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
