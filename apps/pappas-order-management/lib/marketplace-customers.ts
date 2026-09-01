import { supabase } from './supabase';

import type { MarketplaceProvider } from './marketplace-pos-order';

export async function resolveMarketplaceCustomer(input: {
  provider: MarketplaceProvider;
  externalCustomerId: string;
  customerName: string;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const externalCustomerId = input.externalCustomerId.trim();
    if (!externalCustomerId) return { data: null, error: null };

    const { data, error } = await supabase.rpc('resolve_marketplace_customer', {
      p_provider: input.provider,
      p_external_customer_id: externalCustomerId,
      p_full_name: input.customerName.trim() || null,
    });
    if (error || typeof data !== 'string' || !data) {
      return { data: null, error: error?.message || 'Marketplace customer resolution returned no profile.' };
    }

    return { data: { id: data }, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Failed to resolve marketplace customer.' };
  }
}
