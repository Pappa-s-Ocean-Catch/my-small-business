import { type CatalogCategory, type CatalogProduct, type CatalogSnapshot } from '@my-small-business/pos-domain';

export type CatalogStatus = 'idle' | 'loading' | 'ready' | 'refreshing' | 'error';
export type CatalogRefreshReason = 'startup' | 'manual' | 'realtime';
export type CatalogState<TSnapshot extends CatalogSnapshot = CatalogSnapshot> = { status: CatalogStatus; snapshot: TSnapshot | null; error: string | null };

export function createCatalogStore<TSnapshot extends CatalogSnapshot>({ load }: { load: () => Promise<TSnapshot> }) {
  let state: CatalogState<TSnapshot> = { status: 'idle', snapshot: null, error: null };
  let generation = 0;
  const listeners = new Set<(next: CatalogState<TSnapshot>) => void>();
  const publish = () => listeners.forEach((listener) => listener(state));

  return {
    getState: () => state,
    subscribe(listener: (next: CatalogState<TSnapshot>) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    reset() { generation += 1; state = { status: 'idle', snapshot: null, error: null }; publish(); },
    async refresh(_reason: CatalogRefreshReason) {
      const requestGeneration = ++generation;
      state = { ...state, status: state.snapshot ? 'refreshing' : 'loading', error: null }; publish();
      try {
        const snapshot = await load();
        if (requestGeneration === generation) { state = { status: 'ready', snapshot, error: null }; publish(); }
      } catch (error) {
        if (requestGeneration === generation) { state = { status: state.snapshot ? 'ready' : 'error', snapshot: state.snapshot, error: error instanceof Error ? error.message : 'Unable to load catalogue.' }; publish(); }
        throw error;
      }
    },
  };
}
