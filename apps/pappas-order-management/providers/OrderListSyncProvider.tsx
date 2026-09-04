import { useEffect, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { createOrderListSync, ORDER_LIST_SYNC_QUERY_KEYS } from '@/lib/order-list-sync';
import { formatPerformanceDuration, isSlowOperation } from '@/lib/performance-trace';
import { supabase } from '@/lib/supabase';
import { usePrinterAutomationStore } from '@/stores/printerAutomationStore';

export function OrderListSyncProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const sync = createOrderListSync((signalCount) => {
      const startedAtMs = Date.now();
      ORDER_LIST_SYNC_QUERY_KEYS.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey });
      });
      const durationMs = Date.now() - startedAtMs;
      if (signalCount > 1 || isSlowOperation(durationMs)) {
        usePrinterAutomationStore.getState().addJournalEntry({
          level: 'decision',
          scope: 'performance',
          message: 'Order-list realtime refresh queued',
          details: `signals=${signalCount} queueWork=${formatPerformanceDuration(durationMs)}`,
        });
      }
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
