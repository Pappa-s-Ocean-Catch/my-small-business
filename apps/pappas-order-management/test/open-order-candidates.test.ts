import assert from 'node:assert/strict';
import test from 'node:test';

import type { Order } from '@my-small-business/types';
import {
  getAutoPrintableScheduledOrderCandidateIds,
  getLiveOrderCandidateIds,
  getOnTheWayOrderCandidateIds,
  getOpenOrderCandidateRange,
  getPreOrderCandidateIds,
  getUniqueOrderIds,
  type OpenOrderCandidate,
} from '../lib/open-order-candidates';

const nowMs = Date.parse('2026-07-28T10:00:00.000Z');

function candidate(overrides: Partial<OpenOrderCandidate> = {}): OpenOrderCandidate {
  return {
    id: 'order-1',
    created_at: '2026-07-28T09:00:00.000Z',
    scheduled_pickup_at: null,
    order_status: 'pending',
    payment_status: 'paid',
    ...overrides,
  } as OpenOrderCandidate;
}

test('builds the open-order candidate range for the preceding 14 days', () => {
  assert.deepEqual(getOpenOrderCandidateRange(nowMs), {
    since: '2026-07-14T10:00:00.000Z',
  });
});

test('selects only Live Order candidates for full detail hydration', () => {
  assert.deepEqual(getLiveOrderCandidateIds([
    candidate({ id: 'asap' }),
    candidate({ id: 'due-soon', scheduled_pickup_at: '2026-07-28T10:30:00.000Z' }),
    candidate({ id: 'future', scheduled_pickup_at: '2026-07-28T10:30:00.001Z' }),
    candidate({ id: 'on-the-way', order_status: 'on_the_way' }),
    candidate({ id: 'refunded', payment_status: 'refunded' }),
    candidate({ id: 'completed', order_status: 'completed' }),
  ], nowMs), ['asap', 'due-soon']);
});

test('keeps future preorders inside the 14-day open-order source window', () => {
  assert.deepEqual(getPreOrderCandidateIds([
    candidate({ id: 'future-preorder', scheduled_pickup_at: '2026-08-01T10:00:00.000Z' }),
    candidate({ id: 'asap' }),
    candidate({ id: 'completed-preorder', order_status: 'completed', scheduled_pickup_at: '2026-08-01T10:00:00.000Z' }),
  ], nowMs), ['future-preorder']);
});

test('selects only printable scheduled orders in the existing automation window', () => {
  assert.deepEqual(getAutoPrintableScheduledOrderCandidateIds([
    candidate({ id: 'pending', scheduled_pickup_at: '2026-07-28T10:15:00.000Z' }),
    candidate({ id: 'confirmed', order_status: 'confirmed', scheduled_pickup_at: '2026-07-28T10:30:00.000Z' }),
    candidate({ id: 'preparing', order_status: 'preparing', scheduled_pickup_at: '2026-07-28T10:15:00.000Z' }),
    candidate({ id: 'future', scheduled_pickup_at: '2026-07-28T10:30:00.001Z' }),
    candidate({ id: 'old', scheduled_pickup_at: '2026-07-21T09:59:59.999Z' }),
  ], nowMs), ['pending', 'confirmed']);
});

test('does not select a terminal candidate even if a database query returns one', () => {
  const terminalStatuses: Order['order_status'][] = ['completed', 'cancelled', 'refunded'];
  for (const order_status of terminalStatuses) {
    assert.deepEqual(getLiveOrderCandidateIds([candidate({ order_status })], nowMs), []);
  }
});

test('selects on-the-way IDs from the same 14-day open candidate set', () => {
  assert.deepEqual(getOnTheWayOrderCandidateIds([
    candidate({ id: 'on-the-way', order_status: 'on_the_way' }),
    candidate({ id: 'refunded-on-the-way', order_status: 'on_the_way', payment_status: 'refunded' }),
    candidate({ id: 'ready', order_status: 'ready' }),
  ]), ['on-the-way']);
});

test('deduplicates hydration IDs without changing their first-seen order', () => {
  assert.deepEqual(getUniqueOrderIds(['first', 'second', 'first', 'third', 'second']), [
    'first',
    'second',
    'third',
  ]);
});
