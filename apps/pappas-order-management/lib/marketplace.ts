import { supabase } from './supabase';
import { getApiUrl } from '@/utils/orderUtils';

export type MarketplaceProvider = 'uber_eats' | 'doordash';

export type MarketplaceCredentialStatus = {
  provider: MarketplaceProvider;
  configured: boolean;
  updatedAt: string | null;
  configuredBy: string | null;
};

export type MarketplaceHistoryOrder = {
  orderId: string;
  workflowUuid: string;
  orderUuid: string;
  customerName: string;
  salesTotal: string;
  netPayout: string;
  requestedAt: string;
  courierName: string;
  fulfillmentType: string;
  issueType: string;
  orderChannel: string;
  isSubscriber: boolean;
  subscriptionPass: string;
};

export type MarketplaceHistoryResult = {
  provider: MarketplaceProvider;
  orders: MarketplaceHistoryOrder[];
  nextCursor: string | null;
};

export type MarketplaceActiveOrder = {
  orderId: string;
  workflowUuid: string;
  orderUuid: string;
  customerName: string;
  salesTotal: string;
  requestedAt: string;
  courierName: string;
  fulfillmentType: string;
  orderChannel: string;
  status: string;
  statusDescription: string;
};

export type MarketplaceActiveResult = {
  provider: MarketplaceProvider;
  orders: MarketplaceActiveOrder[];
  nextCursor: string | null;
};

export type MarketplaceOrderDetailItemOption = {
  name: string;
  quantity: number;
  price: string | null;
};

export type MarketplaceOrderDetailItemCustomization = {
  name: string;
  options: MarketplaceOrderDetailItemOption[];
};

export type MarketplaceOrderDetailItem = {
  name: string;
  price: string;
  quantity: number;
  specialInstructions: string;
  customizations: MarketplaceOrderDetailItemCustomization[];
};

export type MarketplaceOrderStateChange = {
  changedAt: number;
  orderState: string;
};

export type MarketplaceOrderDetail = {
  orderId: string;
  orderUUID: string;
  requestedAt: number;
  completedAtTimestamp: number | null;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  courierName: string | null;
  courierPhone: string | null;
  restaurantName: string;
  netPayout: string;
  marketplaceFeeRate: string | null;
  fulfillmentType: string;
  orderJobState: string | null;
  statusDescription: string | null;
  checkoutInfo: Array<{ key: string; amount: string; label: string }>;
  orderStateChanges: MarketplaceOrderStateChange[];
  items: MarketplaceOrderDetailItem[];
};

async function getAccessToken() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error(error?.message || 'Missing authenticated session');
  }
  return session.access_token;
}

async function fetchMarketplaceCredentials<T>(provider: MarketplaceProvider, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(getApiUrl(`/api/marketplace/providers/${provider}/credentials`), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null) as { success?: boolean; data?: T; error?: string } | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Marketplace request failed');
  }

  if (!payload.data) {
    throw new Error('Missing marketplace response data');
  }

  return payload.data;
}

export async function getMarketplaceCredentialStatus(provider: MarketplaceProvider) {
  return fetchMarketplaceCredentials<MarketplaceCredentialStatus>(provider, { method: 'GET' });
}

export async function saveMarketplaceCookies(provider: MarketplaceProvider, cookies: string) {
  return fetchMarketplaceCredentials<MarketplaceCredentialStatus>(provider, {
    method: 'POST',
    body: JSON.stringify({ cookies }),
  });
}

export async function deleteMarketplaceCookies(provider: MarketplaceProvider) {
  const token = await getAccessToken();
  const response = await fetch(getApiUrl(`/api/marketplace/providers/${provider}/credentials`), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'Failed to clear marketplace cookies');
  }
}

export async function getMarketplaceHistory(provider: MarketplaceProvider, cursor?: string) {
  const token = await getAccessToken();
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const suffix = params.toString() ? `?${params.toString()}` : '';

  const response = await fetch(getApiUrl(`/api/marketplace/providers/${provider}/history${suffix}`), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => null) as { success?: boolean; data?: MarketplaceHistoryResult; error?: string } | null;
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error || 'Failed to load marketplace history');
  }

  return payload.data;
}

export async function getMarketplaceActiveOrders(provider: MarketplaceProvider, cursor?: string) {
  const token = await getAccessToken();
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const suffix = params.toString() ? `?${params.toString()}` : '';

  const response = await fetch(getApiUrl(`/api/marketplace/providers/${provider}/active${suffix}`), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => null) as { success?: boolean; data?: MarketplaceActiveResult; error?: string } | null;
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error || 'Failed to load marketplace active orders');
  }

  return payload.data;
}

export async function getMarketplaceOrderDetail(provider: MarketplaceProvider, workflowUuid: string) {
  const token = await getAccessToken();
  const response = await fetch(getApiUrl(`/api/marketplace/providers/${provider}/orders/${workflowUuid}`), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => null) as { success?: boolean; data?: MarketplaceOrderDetail; error?: string } | null;
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error || 'Failed to load marketplace order details');
  }

  return payload.data;
}
