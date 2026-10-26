/** Fulfilment and payment intentionally have independent presentation. */
export function fulfilmentTone(status: string): 'success' | 'warning' | 'danger' | 'primary' {
  return status === 'completed' || status === 'ready' ? 'success' : status === 'cancelled' ? 'danger' : status === 'preparing' || status === 'pending' ? 'warning' : 'primary';
}
export function paymentTone(status: string): 'success' | 'danger' | 'neutral' {
  return status === 'paid' ? 'success' : status === 'pending' || status === 'failed' ? 'danger' : 'neutral';
}
export function hasUpcomingOrders(count: number | undefined): boolean {
  return count !== undefined && count > 0;
}

export function orderPaymentLabel(status: string, fulfilmentStatus?: string): string {
  if (status === 'pending') return fulfilmentStatus === 'pending_online_payment' ? 'Waiting for payment' : 'Unpaid';
  if (status === 'paid') return 'Paid';
  if (status === 'failed') return 'Failed';
  if (status === 'refunded') return 'Refunded';
  return status;
}
