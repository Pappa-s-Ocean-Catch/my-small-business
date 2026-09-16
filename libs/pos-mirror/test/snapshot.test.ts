import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMirrorOrderSnapshot,
  isEmptyMirrorOrder,
  parseMirrorOrderSnapshot,
} from '../index';

const fixedNow = () => new Date('2026-09-16T00:00:00.000Z');

test('builds a normalized V1 snapshot with quantity-summed item count', () => {
  const snapshot = buildMirrorOrderSnapshot({
    items: [
      { id: 'line-1', name: '  Fish Pack  ', quantity: 2, unitPrice: 12.505, lineTotal: 25.01 },
      { id: 'line-2', name: 'Chips', quantity: 1, unitPrice: 4.999, lineTotal: 5.004 },
    ],
    subtotal: 30.014,
    discount: 5.005,
    total: 25.009,
  }, fixedNow);

  assert.deepEqual(snapshot, {
    version: 1,
    updatedAt: '2026-09-16T00:00:00.000Z',
    itemCount: 3,
    items: [
      { id: 'line-1', name: 'Fish Pack', quantity: 2, unitPrice: 12.51, lineTotal: 25.01 },
      { id: 'line-2', name: 'Chips', quantity: 1, unitPrice: 5, lineTotal: 5 },
    ],
    subtotal: 30.01,
    discount: 5.01,
    total: 25.01,
  });
});

test('builds the exact empty object for an empty cart', () => {
  const snapshot = buildMirrorOrderSnapshot({
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
  }, fixedNow);

  assert.deepEqual(snapshot, {});
  assert.equal(isEmptyMirrorOrder(snapshot), true);
  assert.equal(isEmptyMirrorOrder([]), false);
  assert.equal(isEmptyMirrorOrder({ version: 1 }), false);
});

test('rounds currency values correctly at floating-point half-cent boundaries', () => {
  const snapshot = buildMirrorOrderSnapshot({
    items: [{ id: 'line-1', name: 'Fish Pack', quantity: 1, unitPrice: 10.075, lineTotal: 10.075 }],
    subtotal: 10.075,
    discount: 0,
    total: 10.075,
  }, fixedNow);

  assert.deepEqual(snapshot, {
    version: 1,
    updatedAt: '2026-09-16T00:00:00.000Z',
    itemCount: 1,
    items: [{ id: 'line-1', name: 'Fish Pack', quantity: 1, unitPrice: 10.08, lineTotal: 10.08 }],
    subtotal: 10.08,
    discount: 0,
    total: 10.08,
  });
});

test('rejects invalid local cart values instead of publishing them', () => {
  assert.throws(() => buildMirrorOrderSnapshot({
    items: [{ id: 'line-1', name: '   ', quantity: 1, unitPrice: 10, lineTotal: 10 }],
    subtotal: 10,
    discount: 0,
    total: 10,
  }, fixedNow), /name/);

  assert.throws(() => buildMirrorOrderSnapshot({
    items: [{ id: 'line-1', name: 'Fish Pack', quantity: 1.5, unitPrice: 10, lineTotal: 10 }],
    subtotal: 10,
    discount: 0,
    total: 10,
  }, fixedNow), /quantity/);

  assert.throws(() => buildMirrorOrderSnapshot({
    items: [{ id: 'line-1', name: 'Fish Pack', quantity: 1, unitPrice: Number.POSITIVE_INFINITY, lineTotal: 10 }],
    subtotal: 10,
    discount: 0,
    total: 10,
  }, fixedNow), /unitPrice/);
});

test('accepts a valid V1 snapshot', () => {
  const value = {
    version: 1,
    updatedAt: '2026-09-16T00:00:00.000Z',
    itemCount: 2,
    items: [{ id: 'line-1', name: 'Fish Pack', quantity: 2, unitPrice: 12.5, lineTotal: 25 }],
    subtotal: 25,
    discount: 0,
    total: 25,
  };

  assert.deepEqual(parseMirrorOrderSnapshot(value), value);
});

test('rejects unsupported versions and non-finite or inconsistent snapshots', () => {
  const base = {
    version: 1,
    updatedAt: '2026-09-16T00:00:00.000Z',
    itemCount: 2,
    items: [{ id: 'line-1', name: 'Fish Pack', quantity: 2, unitPrice: 12.5, lineTotal: 25 }],
    subtotal: 25,
    discount: 0,
    total: 25,
  };

  assert.equal(parseMirrorOrderSnapshot({ ...base, version: 2 }), null);
  assert.equal(parseMirrorOrderSnapshot({ ...base, total: Number.NaN }), null);
  assert.equal(parseMirrorOrderSnapshot({ ...base, itemCount: 1 }), null);
  assert.equal(parseMirrorOrderSnapshot({ ...base, items: [{ ...base.items[0], name: '   ' }] }), null);
});
