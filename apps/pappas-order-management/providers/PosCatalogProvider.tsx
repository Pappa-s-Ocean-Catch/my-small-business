import React, { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { createPosCatalogCoordinator } from '../lib/pos-catalog-coordinator';
import { loadPosCatalogSource } from '../lib/pos-catalog-loader';

export const POS_CATALOG_TABLES = [
  'sale_categories', 'sale_products', 'sale_product_addon_groups', 'addon_groups',
  'addon_items', 'sale_product_ingredients', 'products', 'promotions', 'promotion_products', 'pos_layouts',
] as const;

export const posCatalog = createPosCatalogCoordinator(loadPosCatalogSource);

export function usePosCatalog() {
  const state = useSyncExternalStore(posCatalog.subscribe, posCatalog.getState, posCatalog.getState);
  return { ...state, refresh: posCatalog.refresh };
}

export function PosCatalogProvider({ authenticated, children }: { authenticated: boolean; children: ReactNode }) {
  useEffect(() => {
    if (!authenticated) {
      posCatalog.reset();
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    let startupFallback: ReturnType<typeof setTimeout> | null = null;
    let active = true;
    const channel = supabase.channel('pos-catalogue');
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void posCatalog.refresh('realtime');
      }, 250);
    };
    for (const table of POS_CATALOG_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh);
    }
    // Offline Realtime must not prevent the first usable catalogue load.
    startupFallback = setTimeout(() => {
      startupFallback = null;
      void posCatalog.refresh('startup');
    }, 3000);
    channel.subscribe((status) => {
      if (!active) return;
      if (status === 'SUBSCRIBED') {
        if (startupFallback) {
          clearTimeout(startupFallback);
          startupFallback = null;
          void posCatalog.refresh('startup');
        } else {
          // A late join or reconnect may have missed catalogue changes.
          scheduleRefresh();
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        posCatalog.reportConnectionError('Catalogue live updates disconnected. Refresh to check for changes.');
      }
    });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      if (startupFallback) clearTimeout(startupFallback);
      void supabase.removeChannel(channel);
    };
  }, [authenticated]);

  return <>{children}</>;
}
