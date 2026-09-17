import assert from 'node:assert/strict';
import test from 'node:test';

import { CUSTOMER_QUEUE_SELECT, getOpenOrderLookbackStart } from '../src/lib/customer-queue';

test('selects only customer-safe queue columns', () => {
  assert.equal(CUSTOMER_QUEUE_SELECT, 'order_number,created_at,scheduled_pickup_at,order_status,payment_status');
});

test('uses the existing 14-day open-order lookback window', () => {
  assert.equal(getOpenOrderLookbackStart(Date.parse('2026-09-16T00:00:00.000Z')), '2026-09-02T00:00:00.000Z');
});
