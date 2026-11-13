import { useEffect, useState } from 'react';
import { isAdminUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/** Fail closed while resolving permissions and when the signed-in account changes. */
export function useCouponAdmin(enabled = true) {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    let version = 0;
    let resolvedUserId: string | null = null;
    const refresh = async () => {
      const current = ++version;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!alive || current !== version) return;
        if ((user?.id ?? null) !== resolvedUserId) setIsAdmin(false);
        resolvedUserId = user?.id ?? null;
        const allowed = !!user && await isAdminUser(user.id);
        if (alive && current === version) setIsAdmin(allowed);
      } catch { if (alive && current === version) setIsAdmin(false); }
    };
    if (!enabled) { setIsAdmin(false); return; }
    void refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Return immediately: Supabase holds an auth lock during this callback.
      ++version;
      const nextUserId = session?.user?.id ?? null;
      if (alive && nextUserId !== resolvedUserId) setIsAdmin(false);
      resolvedUserId = nextUserId;
      setTimeout(() => { if (alive) void refresh(); }, 0);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, [enabled]);
  return enabled && isAdmin;
}
