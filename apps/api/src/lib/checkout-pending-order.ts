export function getPendingCheckoutOrderId(
  searchParams: URLSearchParams,
  storedOrderId: string | null,
): string | null {
  return searchParams.get('order_id')
    ?? searchParams.get('orderId')
    ?? storedOrderId;
}

export function getPendingCheckoutCancellationState(
  orderStatus: string | null,
): 'delete' | 'already-cancelled' | 'cannot-cancel' {
  if (orderStatus === null) {
    return 'already-cancelled';
  }

  return orderStatus === 'pending_online_payment'
    ? 'delete'
    : 'cannot-cancel';
}
