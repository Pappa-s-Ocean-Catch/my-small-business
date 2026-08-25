import { supabase } from './supabase';
import { getApiUrl } from '@/utils/orderUtils';
import { loadAppSettings } from './settings';
import { getLocalMarketplaceActiveOrders } from './marketplace-local-active';
import { getLocalMarketplaceHistory, getLocalMarketplaceOrderDetail } from './marketplace-local-active';

export {
  MARKETPLACE_SYNC_INTERVAL_MS,
  createMarketplaceSyncCoordinator,
  isMarketplaceAutoSyncOpenAt,
} from './marketplace-sync';

export type MarketplaceProvider = 'uber_eats' | 'doordash';

export type MarketplaceCredentialStatus = {
  provider: MarketplaceProvider;
  configured: boolean;
  updatedAt: string | null;
  configuredBy: string | null;
  providerConfig: Record<string, string | number | boolean | null>;
};

export type MarketplaceHistoryDateRange =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'LAST_12_WEEKS'
  | 'CUSTOM';

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

export type MarketplaceCredentialSavePayload = {
  cookies: string;
  providerConfig?: Record<string, string | number | boolean | null>;
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
  provider: MarketplaceProvider;
  sourceName: string;
  orderId: string;
  orderUUID: string;
  workflowUuid: string;
  requestedAt: number;
  completedAtTimestamp: number | null;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  courierName: string | null;
  courierPhone: string | null;
  restaurantName: string;
  subtotal: string | null;
  subtotalAmount: number | null;
  discountLabel: string | null;
  discount: string | null;
  discountAmount: number;
  total: string | null;
  totalAmount: number | null;
  netPayout: string;
  marketplaceFeeRate: string | null;
  fulfillmentType: string;
  orderJobState: string | null;
  statusDescription: string | null;
  checkoutInfo: Array<{ key: string; amount: string; label: string }>;
  orderStateChanges: MarketplaceOrderStateChange[];
  items: MarketplaceOrderDetailItem[];
};

export type MarketplaceOrderDetailMode = 'history' | 'live';

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

export async function saveMarketplaceCookies(provider: MarketplaceProvider, payload: MarketplaceCredentialSavePayload) {
  return fetchMarketplaceCredentials<MarketplaceCredentialStatus>(provider, {
    method: 'POST',
    body: JSON.stringify(payload),
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

export async function getMarketplaceHistory(
  provider: MarketplaceProvider,
  options?: { cursor?: string; dateRange?: MarketplaceHistoryDateRange; statuses?: string[]; mode?: 'history' | 'scheduled' }
) {
  const settings = await loadAppSettings();
  if (settings.marketplaceFetchMode === 'local') {
    return getLocalMarketplaceHistory(provider, options) as Promise<MarketplaceHistoryResult>;
  }
  const token = await getAccessToken();
  const params = new URLSearchParams();
  if (options?.cursor) params.set('cursor', options.cursor);
  if (options?.dateRange) params.set('dateRange', options.dateRange);
  if (options?.statuses?.length) params.set('statuses', options.statuses.join(','));
  if (options?.mode) params.set('mode', options.mode);
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

export async function getMarketplaceActiveOrders(
  provider: MarketplaceProvider,
  cursor?: string,
  source: 'marketplace-screen' | 'auto-sync' = 'marketplace-screen',
) {
  const settings = await loadAppSettings();
  const fetchMode = settings.marketplaceFetchMode;
  console.info('[marketplace]', {
    provider,
    operation: 'active-request',
    source,
    fetchMode,
  });
  if (fetchMode === 'local') {
    return getLocalMarketplaceActiveOrders(provider, cursor) as Promise<MarketplaceActiveResult>;
  }
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

export async function getMarketplaceOrderDetail(
  provider: MarketplaceProvider,
  workflowUuid: string,
  options?: { mode?: MarketplaceOrderDetailMode }
) {
  const settings = await loadAppSettings();
  if (settings.marketplaceFetchMode === 'local') {
    return getLocalMarketplaceOrderDetail(provider, workflowUuid, options) as Promise<MarketplaceOrderDetail>;
  }
  const token = await getAccessToken();
  const params = new URLSearchParams();
  if (options?.mode) params.set('mode', options.mode);
  const suffix = params.toString() ? `?${params.toString()}` : '';

  const response = await fetch(getApiUrl(`/api/marketplace/providers/${provider}/orders/${workflowUuid}${suffix}`), {
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
