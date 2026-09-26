import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LoginPage } from './features/auth/LoginPage';
import { createDesktopSecureStore } from './platform/secure-store';
import { createDesktopSupabaseClient } from './lib/supabase';
import { createCatalogStore } from './features/catalog/catalog-store';
import { loadDesktopCatalog } from './features/catalog/supabase-catalog-loader';
import { PosWorkspace } from './features/pos/PosWorkspace';
import { createDesktopPosGateway } from './lib/desktop-pos-gateway';
import { createCheckoutService } from './features/checkout/checkout-service';
import { createDesktopOrderGateway } from './features/orders/desktop-order-gateway';
import { createLiveOrdersStore } from './features/orders/live-orders-store';
import { LiveOrdersWorkspace } from './features/orders/LiveOrdersWorkspace';
import type { DesktopCatalogSnapshot } from './features/pos/pos-types';
import './app.css';

import { AppLayout } from './platform/AppLayout';
import { SettingsWorkspace } from './features/settings/SettingsWorkspace';

export function App() {
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<'new-order' | 'live-orders' | 'customers' | 'settings'>('new-order');

  useEffect(() => {
    async function restoreSession() {
      try {
        const secureStore = createDesktopSecureStore(invoke);
        const supabase = createDesktopSupabaseClient(secureStore, import.meta.env);
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && !error) {
          const { data: serverRole, error: serverRoleError } = await supabase.rpc('current_profile_role');
          const { data: profile } = await supabase.from('profiles').select('role_slug').eq('id', session.user.id).maybeSingle();
          const roleSlug = typeof serverRole === 'string' ? serverRole : profile?.role_slug ?? null;
          
          if (!serverRoleError && (roleSlug === 'admin' || roleSlug === 'staff')) {
            setClient(supabase);
            setUserId(session.user.id);
            console.info('[desktop-pos/auth] session restored successfully');
          } else {
            console.warn('[desktop-pos/auth] Invalid role on restore session, signing out');
            await supabase.auth.signOut();
          }
        }
      } catch (err) {
        console.error('[desktop-pos/auth] error restoring session', err);
      } finally {
        setLoading(false);
      }
    }
    void restoreSession();
  }, []);

  const checkoutService = useMemo(() => client && userId ? createCheckoutService({ gateway: createDesktopPosGateway(client), newId: () => crypto.randomUUID() }) : null, [client, userId]);
  const catalogStore = useMemo(() => createCatalogStore<DesktopCatalogSnapshot>({ load: () => {
    if (!client) throw new Error('Sign in before loading the catalogue.');
    return loadDesktopCatalog(client);
  } }), [client]);
  const [catalogState, setCatalogState] = useState(catalogStore.getState());
  const liveOrdersStore = useMemo(() => client ? createLiveOrdersStore({ load: () => createDesktopOrderGateway(client).loadLiveOrders() }) : null, [client]);

  useEffect(() => catalogStore.subscribe(setCatalogState), [catalogStore]);
  useEffect(() => { if (client) void catalogStore.refresh('startup').catch(() => undefined); }, [client, catalogStore]);

  if (loading) {
    return <main className="loading-shell"><div><p className="eyebrow">PAPPAS POS</p><h1>Loading app…</h1><p className="muted">Restoring your session.</p></div></main>;
  }

  if (client && catalogState.snapshot) {
    const handleSignOut = () => {
      catalogStore.reset();
      void client.auth.signOut();
      setClient(null);
      setUserId(null);
      setView('new-order');
    };

    return (
      <AppLayout currentView={view} onNavigate={setView} onSignOut={handleSignOut}>
        {view === 'live-orders' && liveOrdersStore && <LiveOrdersWorkspace store={liveOrdersStore} />}
        {view === 'new-order' && <PosWorkspace snapshot={catalogState.snapshot} refreshing={catalogState.status === 'refreshing'} onRefresh={() => { void catalogStore.refresh('manual').catch(() => undefined); }} onCheckout={checkoutService ? (lines, paymentMethod) => checkoutService.submitCashCardOrder({ lines, paymentMethod, userId: userId! }) : undefined} />}
        {view === 'customers' && <div style={{ padding: 24 }}><h2>Customers</h2><p>Coming soon...</p></div>}
        {view === 'settings' && <SettingsWorkspace />}
      </AppLayout>
    );
  }

  if (client && catalogState.status === 'loading') return <main className="loading-shell"><div><p className="eyebrow">PAPPAS POS</p><h1>Loading menu…</h1><p className="muted">Fetching the active POS catalogue.</p></div></main>;

  return <LoginPage loading={loading} onSubmit={async (email, password) => {
    setLoading(true);
    try {
      const secureStore = createDesktopSecureStore(invoke);
      const supabase = createDesktopSupabaseClient(secureStore, import.meta.env);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        console.warn('[desktop-pos/auth] sign-in failed', { message: error?.message ?? 'No authenticated user returned.' });
        return { ok: false, message: error?.message ?? 'Unable to sign in.' };
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || sessionData.session?.user.id !== data.user.id) {
        return { ok: false, message: sessionError?.message ?? 'Desktop session could not be persisted. Please retry sign-in.' };
      }
      console.info('[desktop-pos/auth] sign-in succeeded', { userId: data.user.id });
      const { data: profile, error: profileError } = await supabase.from('profiles').select('role_slug').eq('id', data.user.id).maybeSingle();
      const { data: serverRole, error: serverRoleError } = await supabase.rpc('current_profile_role');
      const roleSlug = typeof serverRole === 'string' ? serverRole : profile?.role_slug ?? null;
      console.info('[desktop-pos/auth] profile access check', {
        userId: data.user.id,
        roleSlug,
        directProfileError: profileError ? { message: profileError.message, code: profileError.code, details: profileError.details } : null,
        serverRoleError: serverRoleError ? { message: serverRoleError.message, code: serverRoleError.code, details: serverRoleError.details } : null,
      });
      if (serverRoleError || (roleSlug !== 'admin' && roleSlug !== 'staff')) {
        await supabase.auth.signOut();
        return { ok: false, message: serverRoleError ? `Unable to verify POS access: ${serverRoleError.message}` : 'No matching POS staff profile was returned for this signed-in account.' };
      }
      setClient(supabase);
      setUserId(data.user.id);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Unable to start desktop authentication.' };
    } finally {
      setLoading(false);
    }
  }} />;
}
