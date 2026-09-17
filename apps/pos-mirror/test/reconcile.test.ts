import assert from 'node:assert/strict';
import test from 'node:test';

import { reconcileSnapshot } from '../src/lib/reconcile';

const olderSnapshot = {
  version: 1 as const,
  updatedAt: '2026-09-16T00:00:00.000Z',
  itemCount: 1,
  items: [{ id: 'line-1', name: 'Fish Pack', quantity: 1, unitPrice: 12, lineTotal: 12 }],
  subtotal: 12,
  discount: 0,
  total: 12,
};

const newerSnapshot = { ...olderSnapshot, updatedAt: '2026-09-16T00:01:00.000Z' };

test('keeps the newer realtime snapshot when an older fetch completes later', () => {
  assert.equal(reconcileSnapshot(newerSnapshot, olderSnapshot), newerSnapshot);
});

test('accepts a valid fetched snapshot when no snapshot is mounted', () => {
  assert.deepEqual(reconcileSnapshot(null, olderSnapshot), olderSnapshot);
});

test('keeps the current snapshot when an incoming payload is invalid', () => {
  assert.equal(reconcileSnapshot(olderSnapshot, { version: 2 }), olderSnapshot);
});

test('treats the exact empty object as an idle cart', () => {
  assert.equal(reconcileSnapshot(olderSnapshot, {}), null);
});
