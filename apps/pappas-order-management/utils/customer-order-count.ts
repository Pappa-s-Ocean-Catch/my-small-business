export type CustomerOrderIdentity = {
  id: string;
  user_id?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
};

export type CustomerOrderCountCandidate = CustomerOrderIdentity & {
  payment_status?: string | null;
  order_status?: string | null;
};

function normalizedEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase();
  return email || null;
}

function normalizedPhone(value: string | null | undefined): string | null {
  const phone = value?.trim();
  return phone || null;
}

function hasMatchingContact(left: CustomerOrderIdentity, right: CustomerOrderIdentity): boolean {
  const leftEmail = normalizedEmail(left.customer_email);
  const rightEmail = normalizedEmail(right.customer_email);
  if (leftEmail && rightEmail && leftEmail === rightEmail) return true;

  const leftPhone = normalizedPhone(left.customer_phone);
  const rightPhone = normalizedPhone(right.customer_phone);
  return !!leftPhone && !!rightPhone && leftPhone === rightPhone;
}

export function isSuccessfulCustomerOrder(order: CustomerOrderCountCandidate): boolean {
  return order.payment_status === 'paid'
    && order.order_status !== 'cancelled'
    && order.order_status !== 'refunded';
}

export function formatSuccessfulOrderCount(count: number): string {
  return `${count} successful order${count === 1 ? '' : 's'}`;
}

function belongsToCustomer(candidate: CustomerOrderIdentity, customer: CustomerOrderIdentity): boolean {
  if (customer.user_id) {
    return candidate.user_id === customer.user_id
      || (!candidate.user_id && hasMatchingContact(candidate, customer));
  }

  return !candidate.user_id && hasMatchingContact(candidate, customer);
}

export function getSuccessfulOrderCounts(
  visibleOrders: CustomerOrderIdentity[],
  candidates: CustomerOrderCountCandidate[],
): Record<string, number> {
  return Object.fromEntries(visibleOrders.map((order) => [
    order.id,
    candidates.reduce((count, candidate) => (
      count + (isSuccessfulCustomerOrder(candidate) && belongsToCustomer(candidate, order) ? 1 : 0)
    ), 0),
  ]));
}
