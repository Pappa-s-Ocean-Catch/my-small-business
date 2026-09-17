import assert from 'node:assert/strict';
import test from 'node:test';

import { selectDisplayState } from '../src/lib/display-state';

const activeSnapshot = {
  version: 1 as const,
  updatedAt: '2026-09-16T00:00:00.000Z',
  itemCount: 1,
  items: [{ id: 'line-1', name: 'Fish Pack', quantity: 1, unitPrice: 12, lineTotal: 12 }],
  subtotal: 12,
  discount: 0,
  total: 12,
};

const queue = [{ orderNumber: '12', status: 'Ready' as const, sortAt: '2026-09-16T00:00:00.000Z' }];

test('active carts take priority over the current queue', () => {
  assert.equal(selectDisplayState(activeSnapshot, 'queue', queue).kind, 'cart');
});

test('queue mode shows the current queue only when it has entries', () => {
  assert.equal(selectDisplayState(null, 'queue', queue).kind, 'queue');
  assert.equal(selectDisplayState(null, 'queue', []).kind, 'image');
});

test('image mode remains image mode when a queue is available', () => {
  assert.equal(selectDisplayState(null, 'image', queue).kind, 'image');
});
