const PRE_ORDER_LEAD_MINUTES = 30;
const PRE_ORDER_LEAD_MS = PRE_ORDER_LEAD_MINUTES * 60 * 1000;

export type CustomerQueueCandidate = {
  order_number: string;
  created_at: string;
  scheduled_pickup_at: string | null;
  order_status: string;
  payment_status: string;
};

export type CustomerQueueStatus = 'Pending' | 'Confirmed' | 'Preparing' | 'Ready';

export type CustomerQueueEntry = {
  orderNumber: string;
  status: CustomerQueueStatus;
  sortAt: string;
};

const CUSTOMER_STATUS_BY_ORDER_STATUS: Readonly<Record<string, CustomerQueueStatus>> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
};

function getScheduledPickupMs(candidate: CustomerQueueCandidate): number | null {
  if (!candidate.scheduled_pickup_at) {
    return null;
  }

  const pickupMs = Date.parse(candidate.scheduled_pickup_at);
  return Number.isFinite(pickupMs) ? pickupMs : null;
}

function getCustomerOrderNumber(orderNumber: string): string {
  const trimmed = orderNumber.trim();
  const finalGroup = trimmed.split('-').at(-1)?.trim();
  return finalGroup || trimmed;
}

export function buildCustomerQueue(
  candidates: readonly CustomerQueueCandidate[],
  nowMs: number = Date.now(),
): CustomerQueueEntry[] {
  return candidates
    .flatMap((candidate): CustomerQueueEntry[] => {
      const status = CUSTOMER_STATUS_BY_ORDER_STATUS[candidate.order_status];
      if (!status || candidate.payment_status === 'refunded') {
        return [];
      }

      const scheduledPickupMs = getScheduledPickupMs(candidate);
      if (scheduledPickupMs !== null && scheduledPickupMs - nowMs > PRE_ORDER_LEAD_MS) {
        return [];
      }

      return [{
        orderNumber: getCustomerOrderNumber(candidate.order_number),
        status,
        sortAt: scheduledPickupMs === null
          ? candidate.created_at
          : candidate.scheduled_pickup_at as string,
      }];
    })
    .sort((left, right) => Date.parse(left.sortAt) - Date.parse(right.sortAt));
}
