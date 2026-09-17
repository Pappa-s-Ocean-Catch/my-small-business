import { buildCustomerQueue, type CustomerQueueCandidate, type CustomerQueueEntry } from '@my-small-business/pos-mirror';
import type { SupabaseClient } from '@supabase/supabase-js';

export const CUSTOMER_QUEUE_SELECT = 'order_number,created_at,scheduled_pickup_at,order_status,payment_status';
const OPEN_ORDER_LOOKBACK_DAYS = 14;

export function getOpenOrderLookbackStart(nowMs: number = Date.now()): string {
  return new Date(nowMs - OPEN_ORDER_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export async function fetchCustomerQueue(
  client: SupabaseClient,
  nowMs: number = Date.now(),
): Promise<CustomerQueueEntry[]> {
  const { data, error } = await client
    .from('orders')
    .select(CUSTOMER_QUEUE_SELECT)
    .gte('created_at', getOpenOrderLookbackStart(nowMs))
    .neq('order_status', 'completed')
    .neq('order_status', 'cancelled')
    .neq('order_status', 'refunded')
    .neq('order_status', 'pending_online_payment')
    .neq('payment_status', 'refunded');

  if (error) throw new Error(error.message);
  return buildCustomerQueue((data ?? []) as CustomerQueueCandidate[], nowMs);
}
