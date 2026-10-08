import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node test runner uses source extensions.
import { getDeliverySchedule, validateDeliverySchedule } from './scheduling.ts';

test('scheduled orders preserve ready/pickup and delivery times through delayed payment', () => {
  assert.deepEqual(getDeliverySchedule({ scheduled_pickup_at: '2026-10-09T01:00:00Z', scheduled_delivery_at: '2026-10-09T01:30:00Z', created_at: '2026-10-08T01:00:00Z' }), {
    expected_pickup_at: '2026-10-09T01:00:00.000Z', expected_delivery_at: '2026-10-09T01:30:00.000Z',
  });
});
test('closed-store delivery requires both times', () => {
  assert.ok(validateDeliverySchedule(false, null, null, new Date('2026-10-08T00:00:00Z')));
  assert.ok(validateDeliverySchedule(false, '2026-10-09T01:00:00Z', null, new Date('2026-10-08T00:00:00Z')));
});
test('delivery must follow pickup and schedules cannot be in the past', () => {
  const now = new Date('2026-10-08T00:00:00Z');
  assert.ok(validateDeliverySchedule(true, '2026-10-08T01:00:00Z', '2026-10-08T00:30:00Z', now));
  assert.ok(validateDeliverySchedule(true, '2026-10-07T23:00:00Z', '2026-10-08T00:30:00Z', now));
  assert.equal(validateDeliverySchedule(false, '2026-10-08T01:00:00Z', '2026-10-08T01:30:00Z', now), null);
  assert.equal(validateDeliverySchedule(true, null, null, now), null);
});
test('customer delivery time derives pickup and ready time ten minutes earlier', async () => {
  // @ts-expect-error Node runner uses source extensions.
  const { getPickupTimeForDelivery } = await import('./scheduling.ts');
  assert.equal(getPickupTimeForDelivery('2026-10-09T01:30:00Z'), '2026-10-09T01:20:00.000Z');
  assert.equal(getPickupTimeForDelivery('2026-10-08T13:05:00Z'), '2026-10-08T12:55:00.000Z');
  assert.equal(getPickupTimeForDelivery(null), null);
  assert.equal(getPickupTimeForDelivery('invalid'), null);
});
