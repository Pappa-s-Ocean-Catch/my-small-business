import React, { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { createPosCatalogCoordinator } from '../lib/pos-catalog-coordinator';
import { loadPosCatalogSource } from '../lib/pos-catalog-loader';

export const posCatalog = createPosCatalogCoordinator(loadPosCatalogSource);

export function usePosCatalog() {
  const state = useSyncExternalStore(posCatalog.subscribe, posCatalog.getState, posCatalog.getState);
  return { ...state, refresh: posCatalog.refresh, applyLayout: posCatalog.applyLayout, saveLayoutRecord: posCatalog.saveLayoutRecord };
}

/** Load once per authenticated app session. Catalogue data never expires or refreshes in the background. */
export function PosCatalogProvider({ authenticated, children }: { authenticated: boolean; children: ReactNode }) {
  useEffect(() => {
    if (!authenticated) { posCatalog.reset(); return; }
    void posCatalog.refresh('startup');
  }, [authenticated]);
  return <>{children}</>;
}
