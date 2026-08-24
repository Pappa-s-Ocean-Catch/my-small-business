import {
  createSessionCache,
  type MarketplaceProvider,
  type MarketplaceSessionBundle,
} from '@my-small-business/marketplace';

import { supabase } from './supabase';
import { getApiUrl } from '@/utils/orderUtils';

async function getAccessToken() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error(error?.message || 'Missing authenticated session');
  return session.access_token;
}

async function loadMarketplaceSessionBundle(provider: MarketplaceProvider): Promise<MarketplaceSessionBundle> {
  const token = await getAccessToken();
  const response = await fetch(getApiUrl(`/api/marketplace/providers/${provider}/session`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => null) as {
    success?: boolean;
    data?: MarketplaceSessionBundle;
    error?: string;
  } | null;
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error || 'Failed to load marketplace session');
  }
  return payload.data;
}

const cache = createSessionCache({ now: () => Date.now(), load: loadMarketplaceSessionBundle });

export const getLocalMarketplaceSession = cache.get;
export const invalidateLocalMarketplaceSession = cache.invalidate;
