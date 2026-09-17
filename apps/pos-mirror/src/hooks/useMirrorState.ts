import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { MirrorOrderSnapshotV1 } from '@my-small-business/pos-mirror';

import { reconcileSnapshot } from '../lib/reconcile';
import { supabase } from '../lib/supabase';

export type MirrorConnectionStatus = 'loading' | 'connected' | 'reconnecting' | 'error';

export function useMirrorState(registerId: string) {
  const [snapshot, setSnapshot] = useState<MirrorOrderSnapshotV1 | null>(null);
  const [status, setStatus] = useState<MirrorConnectionStatus>('loading');
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    const normalizedRegisterId = registerId.trim();
    if (!normalizedRegisterId) {
      setSnapshot(null);
      setStatus('connected');
      setWarning(null);
      return;
    }

    let active = true;
    let subscribedOnce = false;
    let channel: RealtimeChannel | null = null;

    const applyOrder = (currentOrder: unknown) => {
      if (!active) return;
      setSnapshot((current) => reconcileSnapshot(current, currentOrder));
    };

    const fetchCurrentOrder = async () => {
      const { data, error } = await supabase
        .from('pos_mirror_state')
        .select('register_id,current_order')
        .eq('register_id', normalizedRegisterId)
        .maybeSingle();

      if (!active) return;
      if (error) {
        setWarning('Unable to refresh the mirrored order. Retrying automatically.');
        setStatus('error');
        return;
      }

      applyOrder(data?.current_order ?? {});
      setWarning(null);
      setStatus('connected');
    };

    channel = supabase
      .channel(`pos-mirror-state:${normalizedRegisterId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_mirror_state', filter: `register_id=eq.${normalizedRegisterId}` },
        (payload) => applyOrder((payload.new as { current_order?: unknown }).current_order ?? {}),
      )
      .subscribe((nextStatus) => {
        if (!active) return;
        if (nextStatus === 'SUBSCRIBED') {
          const reconnect = subscribedOnce;
          subscribedOnce = true;
          setStatus('connected');
          if (reconnect) void fetchCurrentOrder();
          return;
        }
        if (nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT') {
          setStatus('reconnecting');
          setWarning('Connection interrupted. Showing the latest order while reconnecting.');
        }
      });

    void fetchCurrentOrder();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [registerId]);

  return { snapshot, status, warning };
}
