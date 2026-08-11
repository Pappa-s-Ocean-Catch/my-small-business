import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Order } from '@my-small-business/types';
import { buildReportPrintSnapshot } from '../lib/report-printing';

const order = (overrides: Partial<Order>): Order => ({
  id: 'order',
  created_at: '2026-08-03T01:00:00.000Z',
  payment_status: 'paid',
  payment_method: 'cash',
  order_channel: 'instore',
  order_status: 'completed',
  total: 20,
  promotion_discount: 0,
  coupon_discount: 0,
  ...overrides,
} as Order);

test('weekly report snapshot contains selected-period summary and date rows only', () => {
  const snapshot = buildReportPrintSnapshot({
    reportType: 'weekly',
    periodLabel: 'Mon 3 Aug 2026 - Sun 9 Aug 2026',
    generatedAt: new Date('2026-08-10T01:00:00.000Z'),
    orders: [
      order({ id: 'store', total: 20, promotion_discount: 3 }),
      order({
        id: 'uber',
        created_at: '2026-08-04T01:00:00.000Z',
        total: 15,
        order_channel: 'third_party',
        delivery_partner_name: 'Uber Eats',
        marketplace_gross_sales: 15,
        marketplace_gross_payout: 10,
      }),
      order({ id: 'cancelled', payment_status: 'paid', order_status: 'cancelled', total: 100 }),
    ],
  });

  assert.deepEqual(snapshot.summary, {
    grossSales: 35,
    paidOrders: 2,
    averageOrder: 17.5,
    discounts: 3,
  });
  assert.deepEqual(snapshot.salesByDate, [
    { label: 'Mon 3 Aug', total: 20 },
    { label: 'Tue 4 Aug', total: 15 },
  ]);
  assert.equal(snapshot.paymentBreakdown.length, 2);
  assert.equal(snapshot.channelFinancials.length, 3);
  assert.equal('compareTotal' in snapshot, false);
});

test('daily report snapshot omits date rows and returns a zero summary without sales', () => {
  const snapshot = buildReportPrintSnapshot({
    reportType: 'daily',
    periodLabel: 'Mon 10 Aug 2026',
    generatedAt: new Date('2026-08-10T01:00:00.000Z'),
    orders: [],
  });

  assert.equal(snapshot.salesByDate, null);
  assert.deepEqual(snapshot.summary, { grossSales: 0, paidOrders: 0, averageOrder: 0, discounts: 0 });
});

test('report template contains only data receipt sections', () => {
  const source = readFileSync('components/ReportPrintTemplate.tsx', 'utf8');
  assert.match(source, /Summary/);
  assert.match(source, /Gross sales by date/);
  assert.match(source, /Payment method/);
  assert.match(source, /Channel financials/);
  assert.doesNotMatch(source, /LineChart|ComparisonChart|Compare/);
});
