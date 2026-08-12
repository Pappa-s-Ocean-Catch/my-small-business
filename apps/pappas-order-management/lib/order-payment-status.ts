import type { OrderStatus, PaymentStatus } from '@my-small-business/types';

export function getPaymentStatusUpdatePayload(
  currentOrderStatus: OrderStatus,
  paymentStatus: PaymentStatus,
  paymentMethodDetail?: string | null,
) {
  return {
    ...(currentOrderStatus === 'pending_online_payment' && paymentStatus === 'paid'
      ? { order_status: 'confirmed' as const }
      : {}),
    payment_status: paymentStatus,
    payment_method_detail: paymentMethodDetail ?? null,
  };
}
