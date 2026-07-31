import assert from 'node:assert/strict';
import test from 'node:test';
// Node's type-stripping test runner requires the source-file extension.
// @ts-expect-error TypeScript's app configuration intentionally disallows it.
import { groupOrderItemsByOrderId } from './order-items.ts';

test('groups items by order ID while leaving unmatched orders without items', () => {
  const grouped = groupOrderItemsByOrderId([
    { id: 'item-1', order_id: 'order-a' },
    { id: 'item-2', order_id: 'order-b' },
    { id: 'item-3', order_id: 'order-a' },
  ]);

  assert.deepEqual(grouped.get('order-a')?.map((item) => item.id), ['item-1', 'item-3']);
  assert.deepEqual(grouped.get('order-b')?.map((item) => item.id), ['item-2']);
  assert.equal(grouped.get('order-c'), undefined);
});
