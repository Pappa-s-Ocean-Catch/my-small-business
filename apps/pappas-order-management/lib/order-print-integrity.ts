import type { Order } from '@my-small-business/types';

export const ORDER_PRINT_INTEGRITY_WARNING = 'WARNING: ORDER TOTAL DOES NOT MATCH ITEMS — CHECK BEFORE PREPARING';

export function getOrderPrintIntegrityWarning(order: Pick<Order, 'items' | 'subtotal' | 'total' | 'tax' | 'delivery_fee' | 'service_fee' | 'promotion_discount' | 'coupon_discount' | 'reward_points_value' | 'order_channel' | 'marketplace_gross_sales'>): string | null {
  const itemSubtotal = (order.items || []).reduce((sum, item) => sum + Number(item.override_price ?? item.subtotal ?? 0), 0);
  const subtotal = Number(order.subtotal ?? 0);
  const expectedTotal = itemSubtotal
    + Number(order.tax ?? 0)
    + Number(order.delivery_fee ?? 0)
    + Number(order.service_fee ?? 0)
    - Number(order.promotion_discount ?? 0)
    - Number(order.coupon_discount ?? 0)
    - Number(order.reward_points_value ?? 0);
  const marketplaceTotalMismatch = order.order_channel === 'third_party'
    && order.marketplace_gross_sales != null
    && Math.abs(Number(order.marketplace_gross_sales) - Number(order.total ?? 0)) > 0.01;
  return Math.abs(itemSubtotal - subtotal) > 0.01
    || Math.abs(expectedTotal - Number(order.total ?? 0)) > 0.01
    || marketplaceTotalMismatch
    ? ORDER_PRINT_INTEGRITY_WARNING
    : null;
}
