import { supabase } from './supabase';
import { buildStaffAuthorizationHeader } from './pos-api-auth';
import type { 
  DeliveryJobAddress, 
  DeliveryRecipient, 
  DeliveryRequest,
  ShipdayDeliveryPage,
  ShipdayDeliveryDetail
} from '../../../libs/types/delivery-management';

const DEFAULT_SITE_URL = 'https://www.pappasfishnchips.com.au';

function getWebBaseUrl() {
  return (process.env.EXPO_PUBLIC_SITE_URL || DEFAULT_SITE_URL).trim();
}

async function posAuthenticatedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new Error(sessionError?.message || 'Missing authenticated session');
  }

  const response = await fetch(`${getWebBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...buildStaffAuthorizationHeader(session.access_token),
      ...(init?.headers || {}),
    },
  });
  
  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || 'Request failed');
  }
  
  // Return the full payload or data based on expected structure
  // Based on the spec, responses are { success: true, data: ... } or return the request/detail directly inside the wrapper.
  return payload.data !== undefined ? payload.data : payload;
}

export async function getDeliveryOrders(params: { status?: string, from: string, to: string, page: number }): Promise<ShipdayDeliveryPage> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  query.set('from', params.from);
  query.set('to', params.to);
  query.set('page', params.page.toString());
  
  return posAuthenticatedFetch<ShipdayDeliveryPage>(`/api/pos/delivery-management/orders?${query.toString()}`);
}

export async function getDeliveryOrderDetail(id: string, reference: string): Promise<ShipdayDeliveryDetail> {
  const query = new URLSearchParams({ reference }).toString();
  return posAuthenticatedFetch<ShipdayDeliveryDetail>(`/api/pos/delivery-management/orders/${encodeURIComponent(id)}?${query}`);
}

export async function lookupOrder(reference: string): Promise<{ id: string, reference: string, recipient: DeliveryRecipient, address: DeliveryJobAddress | null, deliveryProviderId: string | null }> {
  const query = new URLSearchParams({ reference }).toString();
  return posAuthenticatedFetch(`/api/pos/delivery-management/lookup-order?${query}`);
}

export async function getDeliveryQuotes(address: DeliveryJobAddress): Promise<{ request: DeliveryRequest, pickupAddress: DeliveryJobAddress }> {
  return posAuthenticatedFetch(`/api/pos/delivery-management/quotes`, {
    method: 'POST',
    body: JSON.stringify({ address })
  });
}

export async function requestDelivery(params: { quoteRequestId: string, provider: string, acceptedFee: number, currency: string, recipient: DeliveryRecipient, orderId?: string }): Promise<DeliveryRequest> {
  return posAuthenticatedFetch<DeliveryRequest>(`/api/pos/delivery-management/requests`, {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

export async function getDeliveryRequestStatus(id: string): Promise<DeliveryRequest> {
  return posAuthenticatedFetch<DeliveryRequest>(`/api/pos/delivery-management/requests/${encodeURIComponent(id)}`);
}
