import { supabase } from './supabase';
import { getApiUrl } from '@/utils/orderUtils';

export type MarketplaceProvider = 'uber_eats' | 'doordash';

export type MarketplaceCredentialStatus = {
  provider: MarketplaceProvider;
  configured: boolean;
  updatedAt: string | null;
  configuredBy: string | null;
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
