import test from 'node:test';
import assert from 'node:assert/strict';
import type { Order } from '@my-small-business/types';
import { canPayByLink } from '../utils/pay-by-link';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    order_number: 'ORD-001',
    payment_status: 'pending',
    order_status: 'confirmed',
    ...overrides,
  } as Order;
}

test('permits pay by link only for unpaid active orders', () => {
  assert.equal(canPayByLink(makeOrder()), true);
  assert.equal(canPayByLink(makeOrder({ payment_status: 'paid' })), false);
  assert.equal(canPayByLink(makeOrder({ order_status: 'completed' })), false);
  assert.equal(canPayByLink(makeOrder({ order_status: 'cancelled' })), false);
});
