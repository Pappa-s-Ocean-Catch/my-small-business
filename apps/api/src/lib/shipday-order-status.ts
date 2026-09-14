import type { Order } from '@my-small-business/types';

// Exact values: READY_TO_DELIVER and FAILED_DELIVERY are not delivered.
const DELIVERY_STATUSES: Record<string, string> = {
  pending: 'pending', active: 'pending', not_assigned: 'pending',
  not_accepted: 'assigned', not_started_yet: 'assigned', started: 'assigned',
  assigned: 'assigned', driver_assigned: 'assigned', accepted: 'assigned',
  dispatched: 'assigned', scheduled: 'assigned',
  picked_up: 'inflight', pickedup: 'inflight', pickup_complete: 'inflight',
  in_transit: 'inflight', inflight: 'inflight', enroute: 'inflight', en_route: 'inflight',
  on_the_way: 'inflight', out_for_delivery: 'inflight', ready_to_deliver: 'inflight',
  delivered: 'delivered', already_delivered: 'delivered', completed: 'delivered',
  cancelled: 'cancelled', canceled: 'cancelled',
  failed: 'failed', failed_delivery: 'failed', incomplete: 'failed',
};

const EVENT_STATUSES: Record<string, string> = {
  order_assigned: 'assigned', order_accepted_and_started: 'assigned',
  order_ontheway: 'inflight', order_pikedup: 'inflight', order_pickedup: 'inflight',
  order_completed: 'delivered', order_failed: 'failed', order_incomplete: 'failed',
  order_delete: 'cancelled', order_inserted: 'pending', order_unassigned: 'pending',
};

export function mapShipdayStatus(rawStatus?: string | null, rawEventType?: string | null): string | null {
  const normalize = (value?: string | null) => (value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return DELIVERY_STATUSES[normalize(rawStatus)] ?? EVENT_STATUSES[normalize(rawEventType)] ?? null;
}

/** Advance fulfilment without reopening terminal or refunded orders. */
export function getShipdayOrderStatusUpdate(
  order: Pick<Order, 'order_status' | 'payment_status'>,
  deliveryStatus: string,
): 'on_the_way' | 'completed' | null {
  if (
    ['completed', 'cancelled', 'refunded'].includes(order.order_status)
    || order.payment_status === 'refunded'
  ) return null;

  const nextStatus = deliveryStatus === 'delivered'
    ? 'completed'
    : deliveryStatus === 'inflight' ? 'on_the_way' : null;
  return nextStatus !== order.order_status ? nextStatus : null;
}
