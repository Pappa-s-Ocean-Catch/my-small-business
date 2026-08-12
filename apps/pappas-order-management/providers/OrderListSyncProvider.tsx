import { useEffect, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { createOrderListSync, ORDER_LIST_SYNC_QUERY_KEYS } from '@/lib/order-list-sync';
import { supabase } from '@/lib/supabase';

export function OrderListSyncProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const sync = createOrderListSync(() => {
      ORDER_LIST_SYNC_QUERY_KEYS.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey });
      });
    });
    const channel = supabase
      .channel('order-list-sync-state')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'order_sync_state' },
        () => sync.notify(),
      )
      .subscribe();

    return () => {
      sync.dispose();
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return children;
}
