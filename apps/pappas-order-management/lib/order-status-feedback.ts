export function getOrderActionFeedback(
  orderId: string,
  updatingStatus: string | null,
  actionLabel: string,
): { isUpdating: boolean; label: string } {
  const isUpdating = updatingStatus === orderId;

  return {
    isUpdating,
    label: isUpdating && actionLabel === 'Complete' ? 'Completing…' : actionLabel,
  };
}
