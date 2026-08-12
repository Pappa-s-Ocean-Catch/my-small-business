export function getPendingCheckoutOrderId(
  searchParams: URLSearchParams,
  storedOrderId: string | null,
): string | null {
  return searchParams.get('order_id')
    ?? searchParams.get('orderId')
    ?? storedOrderId;
}
