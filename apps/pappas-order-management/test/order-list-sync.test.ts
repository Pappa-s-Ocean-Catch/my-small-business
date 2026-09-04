import assert from 'node:assert/strict';
import test from 'node:test';

import { createOrderListSync, ORDER_LIST_SYNC_QUERY_KEYS } from '../lib/order-list-sync';

test('coalesces realtime signals into one refresh', async () => {
  let calls = 0;
  let signalCount = 0;
  const sync = createOrderListSync((count) => {
    calls += 1;
    signalCount = count;
  }, 5);

  sync.notify();
  sync.notify();
  sync.notify();

  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(calls, 1);
  assert.equal(signalCount, 3);
  sync.dispose();
});

test('cancels queued refresh on dispose', async () => {
  let calls = 0;
  const sync = createOrderListSync(() => {
    calls += 1;
  }, 5);

  sync.notify();
  sync.dispose();

  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(calls, 0);
});

test('declares only order-list keys', () => {
  assert.deepEqual(ORDER_LIST_SYNC_QUERY_KEYS, [
    ['live-orders'],
    ['on-the-way-orders'],
    ['live-orders', 'pre-order-count'],
    ['pre-orders'],
  ]);
});
