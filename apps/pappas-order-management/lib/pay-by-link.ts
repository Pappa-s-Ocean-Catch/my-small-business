import type { Order } from '@my-small-business/types';
import type { Customer } from './customers';
import { getApiUrl } from '../utils/orderUtils';
export { canPayByLink } from '../utils/pay-by-link';

export type PayByLinkResult = {
  sessionId: string;
  paymentUrl: string;
};

export async function associateCustomerWithOrder(
  orderId: string,
  customer: Customer
): Promise<{ data: Order | null; error: string | null }> {
  const { supabase } = await import('./supabase');
  const { data, error } = await supabase
    .from('orders')
    .update({
      user_id: customer.id,
      customer_name: customer.name || null,
      customer_phone: customer.phone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select()
    .single();

  return { data: (data as Order | null) ?? null, error: error?.message ?? null };
}

export async function createPayByLink(orderId: string): Promise<PayByLinkResult> {
  const { supabase } = await import('./supabase');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new Error(sessionError?.message || 'Please sign in again.');
  }

  const response = await fetch(getApiUrl('/api/pos/create-payment-link'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ orderId }),
  });
  const payload = await response.json().catch(() => null) as Partial<PayByLinkResult> & { error?: string } | null;

  if (!response.ok || !payload?.sessionId || !payload.paymentUrl) {
    throw new Error(payload?.error || 'Failed to create payment link.');
  }

  return { sessionId: payload.sessionId, paymentUrl: payload.paymentUrl };
}
