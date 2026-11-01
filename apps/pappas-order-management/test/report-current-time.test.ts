import assert from 'node:assert/strict';
import test from 'node:test';
import { getDailyReportNowMarker } from '../lib/report-current-time';

test('4pm Melbourne aligns to its daily bucket, including fractional minutes', () => {
  assert.deepEqual(getDailyReportNowMarker('2026-11-01', new Date('2026-11-01T05:00:00Z'), 10, 21), { index: 12, label: 'Now · 4:00 pm' });
  assert.deepEqual(getDailyReportNowMarker('2026-11-01', new Date('2026-11-01T05:15:00Z'), 10, 21), { index: 12.5, label: 'Now · 4:15 pm' });
});
test('marker is hidden for historical reports and outside the chart hours', () => {
  const now = new Date('2026-11-01T05:00:00Z');
  assert.equal(getDailyReportNowMarker('2026-10-31', now, 10, 21), null);
  assert.equal(getDailyReportNowMarker(undefined, now, 10, 21), null);
  assert.equal(getDailyReportNowMarker('2026-11-01', new Date('2026-10-31T22:59:00Z'), 10, 21), null);
  assert.equal(getDailyReportNowMarker('2026-11-01', new Date('2026-11-01T10:01:00Z'), 10, 21), null);
});
test('chart endpoints and winter Melbourne time are handled correctly', () => {
  assert.equal(getDailyReportNowMarker('2026-11-01', new Date('2026-10-31T23:00:00Z'), 10, 21)?.index, 0);
  assert.equal(getDailyReportNowMarker('2026-11-01', new Date('2026-11-01T10:00:00Z'), 10, 21)?.index, 22);
  assert.equal(getDailyReportNowMarker('2026-07-01', new Date('2026-07-01T06:00:00Z'), 10, 21)?.label, 'Now · 4:00 pm');
});
