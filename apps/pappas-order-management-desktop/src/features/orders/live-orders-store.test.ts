import { describe, expect, it } from 'vitest';
import { createLiveOrdersStore } from './live-orders-store';
import type { DesktopOrder } from './order-types';

const order = (): DesktopOrder => ({ id: 'order-1', order_number: 'ORD-1', created_at: new Date().toISOString(), scheduled_pickup_at: null, order_status: 'pending', payment_status: 'paid', payment_method: 'cash', order_channel: 'instore', order_type: 'takeaway', customer_name: 'INSTORE', total: 12, subtotal: 12, tax: 0, items: [] });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((next) => { resolve = next; }); return { promise, resolve }; }

describe('Live Orders store', () => {
  it('does not publish a request that completes after reset', async () => {
    const pending = deferred<DesktopOrder[]>(); const store = createLiveOrdersStore({ load: () => pending.promise });
    const request = store.refresh('startup'); store.reset(); pending.resolve([order()]); await request;
    expect(store.getState().orders).toEqual([]);
  });
  it('retains visible orders after a realtime refresh failure', async () => {
    let calls = 0; const store = createLiveOrdersStore({ load: async () => { calls += 1; if (calls === 1) return [order()]; throw new Error('offline'); } });
    await store.refresh('startup'); await expect(store.refresh('realtime')).rejects.toThrow('offline');
    expect(store.getState()).toMatchObject({ status: 'ready', orders: [expect.any(Object)], error: 'offline' });
  });
});
