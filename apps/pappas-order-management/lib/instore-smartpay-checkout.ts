import type { Order } from '@my-small-business/types';

import type { savePosOrder, updatePaymentStatus } from './orders';

type PosOrderPayload = Parameters<typeof savePosOrder>[0];
type PosOrderItems = Parameters<typeof savePosOrder>[1];

export type PendingInstoreOrderRequest = {
  existingOrder?: Order | null;
  orderPayload: PosOrderPayload;
  items: PosOrderItems;
};

export type SmartpayCheckoutProgressStage = 'creating_order' | 'awaiting_terminal' | 'settling_payment';

export function getSmartpayCheckoutProgress(
  stage: SmartpayCheckoutProgressStage,
  order: Order | null,
): { title: string; message: string; orderNumber: string | null } {
  const orderNumber = getSmartpayDisplayOrderNumber(order);

  switch (stage) {
    case 'creating_order':
      return {
        title: 'Preparing SmartPay payment',
        message: 'Creating order…',
        orderNumber,
      };
    case 'settling_payment':
      return {
        title: 'Saving SmartPay payment',
        message: 'Payment approved. Saving order…',
        orderNumber,
      };
    case 'awaiting_terminal':
      return {
        title: 'SmartPay payment',
        message: 'Follow the prompts on the terminal. This screen will unlock when SmartPay returns the result.',
        orderNumber,
      };
  }
}

export function getSmartpayDisplayOrderNumber(order: Order | null): string | null {
  if (!order) return null;
  return order.order_number.replace(/^ORD-/, '');
}

export function getPendingInstoreOrderLockMessage(order: Order | null): string | null {
  if (!order) return null;
  return `Order #${getSmartpayDisplayOrderNumber(order)} is already saved and must be settled before starting another checkout.`;
}

export function getPendingInstoreRewardPoints(order: Order): number {
  return Number(order.reward_points_used ?? 0);
}

export function getPendingInstorePaymentPlan(
  order: Order,
  smartpayApprovedOrderId: string | null,
  choice: 'smartpay' | 'cash' | 'card' | 'unpaid',
): { detail: 'SmartPay' | 'Cash' | 'Card'; shouldStartTerminal: boolean } {
  if (choice === 'unpaid') {
    throw new Error('This order is already persisted and must be settled as paid.');
  }

  const smartpayApproved = smartpayApprovedOrderId === order.id;
  if (smartpayApproved && choice !== 'smartpay') {
    throw new Error('This order was already approved by SmartPay and must be reconciled as SmartPay.');
  }

  return {
    detail: choice === 'smartpay' ? 'SmartPay' : choice === 'cash' ? 'Cash' : 'Card',
    shouldStartTerminal: choice === 'smartpay' && !smartpayApproved,
  };
}

export async function createOrReusePendingInstoreOrder(
  deps: { savePosOrder: typeof savePosOrder },
  request: PendingInstoreOrderRequest,
): Promise<{ order: Order; created: boolean }> {
  if (request.existingOrder) {
    if (
      request.existingOrder.payment_status !== 'pending'
      || request.existingOrder.order_status !== 'pending_online_payment'
    ) {
      throw new Error('Existing SmartPay order is no longer pending.');
    }

    return { order: request.existingOrder, created: false };
  }

  const { data, error } = await deps.savePosOrder({
    ...request.orderPayload,
    order_channel: 'instore',
    payment_method: 'store',
    payment_status: 'pending',
    payment_method_detail: 'SmartPay',
    order_status: 'pending_online_payment',
  }, request.items);

  if (error || !data) {
    throw new Error(error || 'Failed to create pending SmartPay order.');
  }

  return { order: data, created: true };
}

export async function settlePendingInstorePayment(
  deps: { updatePaymentStatus: typeof updatePaymentStatus },
  orderId: string,
  detail: 'SmartPay' | 'Cash' | 'Card',
): Promise<Order> {
  const { data, error } = await deps.updatePaymentStatus(orderId, 'paid', detail);

  if (error || !data) {
    throw new Error(error || 'Failed to settle pending SmartPay order.');
  }

  return data;
}
