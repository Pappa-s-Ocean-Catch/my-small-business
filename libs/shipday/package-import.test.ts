import assert from 'node:assert/strict';
import test from 'node:test';
import { getDeliverySchedule, validateDeliverySchedule } from '@my-small-business/shipday/scheduling';

test('workspace package exposes scheduling without relative repository paths', () => {
  assert.deepEqual(getDeliverySchedule({ scheduled_pickup_at: '2026-10-09T01:00:00Z', scheduled_delivery_at: '2026-10-09T01:30:00Z' }), {
    expected_pickup_at: '2026-10-09T01:00:00.000Z', expected_delivery_at: '2026-10-09T01:30:00.000Z',
  });
  assert.ok(validateDeliverySchedule(false));
});
