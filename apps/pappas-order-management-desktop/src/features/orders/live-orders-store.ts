import type { DesktopOrder } from './order-types';

export type LiveOrdersState = { status: 'idle' | 'loading' | 'refreshing' | 'ready' | 'error'; orders: DesktopOrder[]; error: string | null };
export type LiveOrdersRefreshReason = 'startup' | 'manual' | 'realtime';

export function createLiveOrdersStore({ load }: { load: () => Promise<DesktopOrder[]> }) {
  let state: LiveOrdersState = { status: 'idle', orders: [], error: null };
  let generation = 0;
  const listeners = new Set<(state: LiveOrdersState) => void>();
  const publish = () => listeners.forEach((listener) => listener(state));
  return {
    getState: () => state,
    subscribe(listener: (state: LiveOrdersState) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    reset() { generation += 1; state = { status: 'idle', orders: [], error: null }; publish(); },
    async refresh(_reason: LiveOrdersRefreshReason) {
      const requestGeneration = ++generation;
      state = { ...state, status: state.orders.length ? 'refreshing' : 'loading', error: null }; publish();
      try {
        const orders = await load();
        if (requestGeneration === generation) { state = { status: 'ready', orders, error: null }; publish(); }
      } catch (error) {
        if (requestGeneration === generation) { state = { status: state.orders.length ? 'ready' : 'error', orders: state.orders, error: error instanceof Error ? error.message : 'Unable to load Live Orders.' }; publish(); }
        throw error;
      }
    },
  };
}
