import type { SupabaseClient } from '@supabase/supabase-js';
import type { PosGateway, SaveInstoreOrderInput } from '@my-small-business/pos-domain';
import { loadDesktopCatalog } from '../features/catalog/supabase-catalog-loader';

export function createDesktopPosGateway(client: SupabaseClient): PosGateway {
  return {
    loadCatalog: () => loadDesktopCatalog(client),
    async saveOrder(input: SaveInstoreOrderInput) {
      const { data, error } = await client.rpc('save_pos_order_atomic', { p_order_id: input.orderId, p_order: input.order, p_items: input.items });
      if (error || !data) throw new Error(error?.message ?? 'Failed to save POS order.');
      return data as { id: string };
    },
  };
}
