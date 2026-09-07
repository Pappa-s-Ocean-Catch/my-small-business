import assert from 'node:assert/strict';
import Module from 'node:module';
import test from 'node:test';
import type { Order } from '@my-small-business/types';

let orders: Order[] = [];
let refreshed: string[] = [];
let refreshError: string | null = null;
const loader = Module as unknown as { _load: (...args: unknown[]) => unknown };
const originalLoad = loader._load;
loader._load = (request, parent, isMain) => {
  if (request === '@tanstack/react-query') return { useQuery: (options: unknown) => options };
  if (request === '@/lib/orders') return {
    getOpenOrderCandidates: async () => ({ data: orders, error: null }),
    getOrdersByIds: async (ids: string[]) => ({ data: orders.filter((order) => ids.includes(order.id)), error: null }),
    refreshDeliveryStatus: async (id: string) => {
      refreshed.push(id);
      return { data: refreshError ? null : { ...orders.find((order) => order.id === id), order_status: 'completed' }, error: refreshError };
    },
  };
  if (request === '@/stores/printerAutomationStore') return {};
  if (typeof request === 'string' && request.startsWith('@/lib/')) {
    return originalLoad.call(loader, `../lib/${request.slice('@/lib/'.length)}`, parent, isMain);
  }
  return originalLoad.call(loader, request, parent, isMain);
};
const { fetchOnTheWayOrders, useOnTheWayOrdersQuery } = require('../hooks/useLiveOrdersQuery') as typeof import('../hooks/useLiveOrdersQuery');
loader._load = originalLoad;

test('on-the-way refresh polls linked Shipday deliveries and removes completed deliveries', async () => {
  orders = [
    { id: 'shipday', order_type: 'delivery', delivery_provider_id: '123', order_status: 'on_the_way', payment_status: 'paid' },
    { id: 'marketplace', order_type: 'pickup', order_status: 'on_the_way', payment_status: 'paid' },
  ] as Order[];
  refreshed = [];
  refreshError = null;
  const result = await fetchOnTheWayOrders();
  assert.deepEqual(refreshed, ['shipday']);
  assert.deepEqual(result.map((order) => order.id), ['marketplace']);
});

test('a Shipday refresh failure keeps the last known on-the-way delivery visible', async () => {
  orders = [{ id: 'shipday', order_type: 'delivery', delivery_provider_id: '123', order_status: 'on_the_way', payment_status: 'paid' }] as Order[];
  refreshError = 'Shipday unavailable';
  assert.deepEqual((await fetchOnTheWayOrders()).map((order) => order.id), ['shipday']);
});

test('on-the-way orders continue periodic refreshes after leaving Live Orders', () => {
  const options = useOnTheWayOrdersQuery() as unknown as { refetchInterval: number };
  assert.ok(options.refetchInterval > 0 && options.refetchInterval <= 60_000);
});
