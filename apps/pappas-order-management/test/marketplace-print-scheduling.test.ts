import assert from 'node:assert/strict';
import test from 'node:test';

import { getOrderAnnouncementDelayMs } from '../lib/marketplace-print-scheduling';

test('prints a newly received marketplace order after the normal printer delay even when its reporting date is in the future', () => {
  const nowMs = Date.parse('2026-08-10T08:00:00.000Z');
  const delayMs = 3_000;

  assert.equal(
    getOrderAnnouncementDelayMs({ order_channel: 'third_party', created_at: '2026-08-11T08:00:00.000Z' }, delayMs, nowMs),
    delayMs,
  );
});

test('keeps the original created-at scheduling behavior for non-marketplace orders', () => {
  const nowMs = Date.parse('2026-08-10T08:00:00.000Z');
  const delayMs = 3_000;

  assert.equal(
    getOrderAnnouncementDelayMs({ order_channel: 'instore', created_at: '2026-08-10T08:00:01.000Z' }, delayMs, nowMs),
    4_000,
  );
});
