import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { CustomerQueueEntry } from '@my-small-business/pos-mirror';

import { fetchCustomerQueue } from '../lib/customer-queue';
import { supabase } from '../lib/supabase';

export type QueueConnectionStatus = 'idle' | 'loading' | 'connected' | 'reconnecting' | 'error';

export function useCustomerQueue(enabled: boolean) {
  const [orders, setOrders] = useState<CustomerQueueEntry[]>([]);
  const [status, setStatus] = useState<QueueConnectionStatus>(enabled ? 'loading' : 'idle');
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setWarning(null);
      return;
    }

    let active = true;
    let subscribedOnce = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: RealtimeChannel | null = null;

    const refresh = async () => {
      try {
        const nextOrders = await fetchCustomerQueue(supabase);
        if (!active) return;
        setOrders(nextOrders);
        setWarning(null);
        setStatus('connected');
      } catch {
        if (!active) return;
        setStatus('error');
        setWarning('Queue updates are reconnecting. Showing the latest queue.');
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void refresh(), 250);
    };

    setStatus('loading');
    void refresh();
    channel = supabase
      .channel('pos-mirror-order-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_sync_state' }, scheduleRefresh)
      .subscribe((nextStatus) => {
        if (!active) return;
        if (nextStatus === 'SUBSCRIBED') {
          const reconnect = subscribedOnce;
          subscribedOnce = true;
          if (reconnect) scheduleRefresh();
        } else if (nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT') {
          setStatus('reconnecting');
          setWarning('Queue updates are reconnecting. Showing the latest queue.');
        }
      });

    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [enabled]);

  return { orders, status, warning };
}
