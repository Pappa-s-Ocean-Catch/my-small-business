import test from 'node:test';
import assert from 'node:assert/strict';
import { getRollingReportRanges } from '../lib/report-periods';

test('uses yesterday through fifteen days ago and the preceding fifteen-day comparison', () => {
  assert.deepEqual(getRollingReportRanges('2026-08-11', 15), {
    current: { start: '2026-07-27', end: '2026-08-10' },
    compare: { start: '2026-07-12', end: '2026-07-26' },
  });
});

test('clamps custom rolling days to one through 180', () => {
  assert.equal(getRollingReportRanges('2026-08-11', 0).current.start, '2026-08-10');
  assert.equal(getRollingReportRanges('2026-08-11', 999).current.start, '2026-02-12');
});
