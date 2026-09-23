import { buildPosCatalogSnapshot, type PosCatalogSnapshot, type PosCatalogSource } from './pos-catalog-snapshot';

export type PosCatalogState = {
  status: 'idle' | 'loading' | 'ready' | 'refreshing' | 'error';
  snapshot: PosCatalogSnapshot | null;
  error: string | null;
  lastUpdatedAt: number | null;
};

export function createPosCatalogCoordinator(load: () => Promise<PosCatalogSource>) {
  let state: PosCatalogState = { status: 'idle', snapshot: null, error: null, lastUpdatedAt: null };
  let epoch = 0;
  let inFlight: Promise<void> | null = null;
  let queued = false;
  const listeners = new Set<() => void>();
  const publish = (next: PosCatalogState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };

  const run = async (requestEpoch: number): Promise<void> => {
    publish({ ...state, status: state.snapshot ? 'refreshing' : 'loading', error: null });
    try {
      const source = await load();
      if (requestEpoch !== epoch) return;
      const snapshot = buildPosCatalogSnapshot(source);
      publish({ status: 'ready', snapshot, error: null, lastUpdatedAt: Date.now() });
    } catch (error) {
      if (requestEpoch !== epoch) return;
      publish({ ...state, status: state.snapshot ? 'ready' : 'error', error: error instanceof Error ? error.message : String(error) });
    }
  };

  const start = (): Promise<void> => {
    const requestEpoch = epoch;
    const promise = (async () => {
      do {
        queued = false;
        await run(requestEpoch);
      } while (queued && epoch === requestEpoch);
    })();
    inFlight = promise;
    void promise.finally(() => { if (inFlight === promise) inFlight = null; });
    return promise;
  };

  return {
    getState: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh: (reason: 'startup' | 'manual' | 'realtime' | 'selection') => {
      if (inFlight) {
        if (reason !== 'startup') queued = true;
        return inFlight;
      }
      return start();
    },
    reportConnectionError: (message: string) => {
      publish({ ...state, error: message });
    },
    reset: () => {
      epoch += 1;
      queued = false;
      inFlight = null;
      publish({ status: 'idle', snapshot: null, error: null, lastUpdatedAt: null });
    },
  };
}
