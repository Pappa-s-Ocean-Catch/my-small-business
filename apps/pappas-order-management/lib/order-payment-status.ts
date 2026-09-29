import type { OrderStatus, PaymentStatus } from '@my-small-business/types';

export function getSettlementPaymentMethod(
  paymentStatus: PaymentStatus,
  paymentMethodDetail?: string | null,
): 'store' | null {
  return paymentStatus === 'paid' && paymentMethodDetail?.trim().toLowerCase() === 'cash'
    ? 'store'
    : null;
}

export function getPaymentStatusUpdatePayload(
  currentOrderStatus: OrderStatus,
  paymentStatus: PaymentStatus,
  paymentMethodDetail?: string | null,
) {
  const paymentMethod = getSettlementPaymentMethod(paymentStatus, paymentMethodDetail);
  return {
    ...(currentOrderStatus === 'pending_online_payment' && paymentStatus === 'paid'
      ? { order_status: 'confirmed' as const }
      : {}),
    payment_status: paymentStatus,
    ...(paymentMethod ? { payment_method: paymentMethod } : {}),
    payment_method_detail: paymentMethodDetail ?? null,
  };
}

export function getEditedPosOrderPaymentUpdate(
  currentOrderStatus: OrderStatus,
  paymentStatus: PaymentStatus,
  paymentMethodDetail?: string | null,
) {
  const paymentUpdate = getPaymentStatusUpdatePayload(
    currentOrderStatus,
    paymentStatus,
    paymentMethodDetail,
  );

  return currentOrderStatus === 'pending_online_payment'
    ? { ...paymentUpdate, order_status: 'confirmed' as const }
    : paymentUpdate;
}
