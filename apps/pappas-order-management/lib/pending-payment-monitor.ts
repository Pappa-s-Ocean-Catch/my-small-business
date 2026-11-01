/** A failed read is not a failed payment. Keep monitoring until payment is confirmed. */
export async function refreshPendingPayment(
  orderId: string,
  read: (id: string) => Promise<{ data: { payment_status: string } | null; error?: unknown }>,
  settled: (id: string) => void,
) {
  try {
    const result = await read(orderId);
    if (!result.error && result.data?.payment_status === 'paid') settled(orderId);
  } catch {
    // A later poll recovers from temporary network/authentication failures.
  }
}
