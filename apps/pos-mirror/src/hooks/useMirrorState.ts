import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { MirrorOrderSnapshotV1 } from '@my-small-business/pos-mirror';
import { ALL_REGISTERS } from '../lib/mirror-settings';
import { MirrorSession, type MirrorStateRow } from '../lib/mirror-session';
import { supabase } from '../lib/supabase';

export type MirrorConnectionStatus = 'loading' | 'connected' | 'reconnecting' | 'error';

export function useMirrorState(registerIds: readonly string[]) {
  const [snapshot, setSnapshot] = useState<MirrorOrderSnapshotV1 | null>(null);
  const [status, setStatus] = useState<MirrorConnectionStatus>('loading');
  const [warning, setWarning] = useState<string | null>(null);

  const selectionKey = JSON.stringify(registerIds);
  useEffect(() => {
    const ids: string[] = JSON.parse(selectionKey);
    const selected = ids.join(',');
    const all = ids.includes(ALL_REGISTERS);
    setSnapshot(null);
    setWarning(null);
    if (!selected) { setStatus('connected'); return; }
    setStatus('loading');
    let active = true;
    let fetching = false;
    let fetchAgain = false;
    const session = new MirrorSession();

    const fetchCurrentOrders = async () => {
      if (!active) return;
      session.expire();
      setSnapshot(session.snapshot);
      if (fetching) { fetchAgain = true; return; }
      fetching = true;
      const revision = session.revision;
      try {
        let query = supabase.from('pos_mirror_state').select('register_id,current_order');
        if (!all) query = query.in('register_id', ids);
        const { data, error } = await query;
        if (!active) return;
        if (error) throw error;
        session.refresh(((data ?? []) as MirrorStateRow[]).filter(row => all || ids.includes(row.register_id)), revision);
        setSnapshot(session.snapshot);
        setWarning(null);
        setStatus('connected');
      } catch {
        if (active) {
          setWarning('Unable to refresh the mirrored order. Retrying automatically.');
          setStatus('error');
        }
      } finally {
        fetching = false;
        if (fetchAgain && active) { fetchAgain = false; void fetchCurrentOrders(); }
      }
    };

    const channel = supabase.channel(`pos-mirror-state:${selected}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'pos_mirror_state',
        ...(all || ids.length !== 1 ? {} : { filter: `register_id=eq.${ids[0]}` }),
      }, (payload) => {
        if (!active) return;
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Partial<MirrorStateRow>;
        if (typeof row.register_id !== 'string' || (!all && !ids.includes(row.register_id))) return;
        session.apply(row.register_id, payload.eventType === 'DELETE' ? {} : row.current_order);
        setSnapshot(session.snapshot);
      })
      .subscribe((nextStatus) => {
        if (!active) return;
        if (nextStatus === 'SUBSCRIBED') void fetchCurrentOrders();
        else if (nextStatus === 'CHANNEL_ERROR' || nextStatus === 'TIMED_OUT' || nextStatus === 'CLOSED') {
          setStatus('reconnecting');
          setWarning('Connection interrupted. Showing the latest order while reconnecting.');
        }
      });

    // Recover missed events after reconnect, token rotation, foregrounding, or a temporary fetch failure.
    // Keep expiry independent from requests which may stall indefinitely.
    const expiryTimer = setInterval(() => { session.expire(); setSnapshot(session.snapshot); }, 1000);
    const timer = setInterval(() => void fetchCurrentOrders(), 10000);
    const appState = AppState.addEventListener('change', state => { if (state === 'active') void fetchCurrentOrders(); });
    const { data: authListener } = supabase.auth.onAuthStateChange(event => {
      if (event === 'TOKEN_REFRESHED') setTimeout(() => { if (active) void fetchCurrentOrders(); }, 0);
    });
    void fetchCurrentOrders();
    return () => {
      active = false;
      clearInterval(timer);
      clearInterval(expiryTimer);
      appState.remove();
      authListener.subscription.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [selectionKey]);

  return { snapshot, status, warning };
}
