import type { SupabaseClient } from '@supabase/supabase-js';
import { sortDesktopLiveOrders } from './live-order-eligibility';
import type { DesktopOrder } from './order-types';

function toOrder(row: Record<string, unknown>): DesktopOrder {
  return { ...row, total: Number(row.total ?? 0), subtotal: Number(row.subtotal ?? 0), tax: Number(row.tax ?? 0), items: (row.order_items ?? []) as DesktopOrder['items'] } as DesktopOrder;
}

export function createDesktopOrderGateway(client: SupabaseClient) {
  return {
    async loadLiveOrders(nowMs = Date.now()): Promise<DesktopOrder[]> {
      const today = new Date(nowMs);
      today.setHours(0, 0, 0, 0);

      const fifteenDaysAgo = new Date(nowMs - 15 * 24 * 60 * 60 * 1000);

      const { data, error } = await client.from('orders').select('*, order_items(*, order_item_addons(*))')
        .neq('order_status', 'pending_online_payment')
        .neq('payment_status', 'refunded')
        .or(`and(order_status.in.(pending,confirmed,preparing,ready,on_the_way),created_at.gte.${fifteenDaysAgo.toISOString()}),created_at.gte.${today.toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(1000);
      
      if (error) throw new Error(error.message);
      
      return sortDesktopLiveOrders((data ?? []).map((row) => toOrder(row as Record<string, unknown>)));
    },
  };
}
