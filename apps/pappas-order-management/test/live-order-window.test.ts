import test from 'node:test';
import assert from 'node:assert/strict';
import type { Order } from '@my-small-business/types';
import {
  getAutoPrintableLiveOrders,
  getScheduledOrderAutomationRange,
  isLiveOrder,
} from '../lib/live-order-window';

const nowMs = Date.parse('2026-07-28T10:00:00.000Z');

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    order_number: 'ORD-001',
    order_status: 'pending',
    payment_status: 'paid',
    scheduled_pickup_at: null,
    ...overrides,
  } as Order;
}

test('includes a preorder exactly 30 minutes before pickup', () => {
  const order = makeOrder({ scheduled_pickup_at: '2026-07-28T10:30:00.000Z' });

  assert.equal(isLiveOrder(order, nowMs), true);
});

test('excludes a preorder more than 30 minutes before pickup', () => {
  const order = makeOrder({ scheduled_pickup_at: '2026-07-28T10:30:00.001Z' });

  assert.equal(isLiveOrder(order, nowMs), false);
});

test('selects only pending or confirmed live orders for auto-print', () => {
  const orders = [
    makeOrder({ id: 'pending', order_status: 'pending' }),
    makeOrder({ id: 'confirmed', order_status: 'confirmed' }),
    makeOrder({ id: 'preparing', order_status: 'preparing' }),
    makeOrder({ id: 'future', scheduled_pickup_at: '2026-07-28T11:00:00.000Z' }),
  ];

  assert.deepEqual(
    getAutoPrintableLiveOrders(orders, nowMs).map((order) => order.id),
    ['pending', 'confirmed'],
  );
});

test('uses a one-week scheduled pickup window for preorder automation', () => {
  assert.deepEqual(getScheduledOrderAutomationRange(nowMs), {
    from: '2026-07-21T10:00:00.000Z',
    until: '2026-07-28T10:30:00.000Z',
  });
});
