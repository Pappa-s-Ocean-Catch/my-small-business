import type { Order } from '@my-small-business/types';

export function canPayByLink(order: Pick<Order, 'payment_status' | 'order_status'>) {
  return order.payment_status !== 'paid'
    && order.payment_status !== 'refunded'
    && !['cancelled', 'completed'].includes(order.order_status);
}
