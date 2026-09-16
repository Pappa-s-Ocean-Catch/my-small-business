import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCustomerQueue,
  type CustomerQueueCandidate,
} from '../index';

const nowMs = Date.parse('2026-09-16T10:00:00.000Z');

function candidate(overrides: Partial<CustomerQueueCandidate> = {}): CustomerQueueCandidate {
  return {
    order_number: 'ORD-001',
    created_at: '2026-09-16T09:00:00.000Z',
    scheduled_pickup_at: null,
    order_status: 'pending',
    payment_status: 'paid',
    ...overrides,
  };
}

test('maps active order statuses to customer-readable labels', () => {
  const queue = buildCustomerQueue([
    candidate({ order_number: '1', order_status: 'pending' }),
    candidate({ order_number: '2', order_status: 'confirmed' }),
    candidate({ order_number: '3', order_status: 'preparing' }),
    candidate({ order_number: '4', order_status: 'ready' }),
  ], nowMs);

  assert.deepEqual(queue.map(({ orderNumber, status }) => ({ orderNumber, status })), [
    { orderNumber: '1', status: 'Pending' },
    { orderNumber: '2', status: 'Confirmed' },
    { orderNumber: '3', status: 'Preparing' },
    { orderNumber: '4', status: 'Ready' },
  ]);
});

test('excludes closed, refunded, on-the-way, pending-payment, and future scheduled orders', () => {
  const queue = buildCustomerQueue([
    candidate({ order_number: 'completed', order_status: 'completed' }),
    candidate({ order_number: 'cancelled', order_status: 'cancelled' }),
    candidate({ order_number: 'refunded-status', order_status: 'refunded' }),
    candidate({ order_number: 'refunded-payment', payment_status: 'refunded' }),
    candidate({ order_number: 'on-the-way', order_status: 'on_the_way' }),
    candidate({ order_number: 'awaiting-payment', order_status: 'pending_online_payment', payment_status: 'pending' }),
    candidate({ order_number: 'future', scheduled_pickup_at: '2026-09-16T10:30:00.001Z' }),
    candidate({ order_number: 'boundary', scheduled_pickup_at: '2026-09-16T10:30:00.000Z' }),
  ], nowMs);

  assert.deepEqual(queue, [{
    orderNumber: 'boundary',
    status: 'Pending',
    sortAt: '2026-09-16T10:30:00.000Z',
  }]);
});

test('sorts oldest first by scheduled pickup time or creation time', () => {
  const queue = buildCustomerQueue([
    candidate({ order_number: 'scheduled-later', scheduled_pickup_at: '2026-09-16T10:20:00.000Z' }),
    candidate({ order_number: 'asap-oldest', created_at: '2026-09-16T08:30:00.000Z' }),
    candidate({ order_number: 'scheduled-earlier', scheduled_pickup_at: '2026-09-16T10:10:00.000Z' }),
  ], nowMs);

  assert.deepEqual(queue.map((entry) => entry.orderNumber), [
    'asap-oldest',
    'scheduled-earlier',
    'scheduled-later',
  ]);
});

test('projects only public queue fields', () => {
  const privateCandidate = {
    ...candidate({ order_number: 'ORD-PRIVATE' }),
    id: 'database-id',
    customer_name: 'Private Customer',
    payment_method: 'card',
    staff_notes: 'private note',
  };

  const queue = buildCustomerQueue([privateCandidate], nowMs);

  assert.deepEqual(queue, [{
    orderNumber: 'ORD-PRIVATE',
    status: 'Pending',
    sortAt: '2026-09-16T09:00:00.000Z',
  }]);
  assert.deepEqual(Object.keys(queue[0]).sort(), ['orderNumber', 'sortAt', 'status']);
});
