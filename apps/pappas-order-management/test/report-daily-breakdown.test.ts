import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDailyReportBreakdown } from '../lib/report-daily-breakdown';

test('lists every day in the report range in ascending date order, including days without sales', () => {
  const rows = buildDailyReportBreakdown({
    range: { start: '2026-08-01', end: '2026-08-04' },
    orders: [
      { created_at: '2026-08-04T11:00:00.000Z', total: 40 },
      { created_at: '2026-08-01T11:00:00.000Z', total: 10 },
      { created_at: '2026-08-04T13:00:00.000Z', total: 15 },
    ],
    getDayKey: (order) => order.created_at.slice(0, 10),
    getTotal: (order) => order.total,
    formatLabel: (date) => date,
  });

  assert.deepEqual(rows, [
    { label: '2026-08-01', orders: 1, total: 10 },
    { label: '2026-08-02', orders: 0, total: 0 },
    { label: '2026-08-03', orders: 0, total: 0 },
    { label: '2026-08-04', orders: 2, total: 55 },
  ]);
});
