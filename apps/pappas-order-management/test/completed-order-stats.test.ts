import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order } from '@my-small-business/types';
import { buildCompletedOrderStats } from '../lib/completed-order-stats';
import { buildChannelFinancialBreakdown } from '../lib/marketplace-pos-import';

const order = (overrides: Partial<Order> = {}): Order => ({
  order_channel: 'instore', payment_method: 'store', payment_method_detail: 'Cash',
  payment_status: 'paid', order_status: 'completed', total: 100,
  delivery_partner_name: null, marketplace_gross_sales: null, marketplace_gross_payout: null,
  ...overrides,
} as Order);
const uber = (overrides: Partial<Order> = {}) => order({
  order_channel: 'third_party', delivery_partner_name: 'Uber Eats',
  marketplace_gross_sales: 100, ...overrides,
});

test('Report implements the requested ten percent deduction and marketplace commission policy', () => {
  for (const [input, expected] of [
    [order(), 90],
    [order({ order_channel: 'phone_pickup' }), 90],
    [order({ payment_method_detail: 'Card' }), 90],
    [uber({ marketplace_gross_payout: 80 }), 72],
    [uber(), 63],
    [uber({ marketplace_gross_payout: 0 }), 0],
  ] as const) {
    assert.equal(buildChannelFinancialBreakdown([input]).reduce((sum, row) => sum + (row.netSales ?? 0), 0), expected);
  }
});

test('Completed shows Report net sales and retains gross collection figures by payment type', () => {
  const inputs = [order(), order({ payment_method_detail: 'Card' }), uber({ total: 95, marketplace_gross_payout: 80 }), uber()];
  assert.deepEqual(buildCompletedOrderStats(inputs), {
    totalOrders: 4, totalNetSales: 315, totalCash: 100, totalCard: 100, totalMarketplace: 195,
  });
});

test('Completed excludes unpaid, cancelled and refunded orders as Report does', () => {
  assert.deepEqual(buildCompletedOrderStats([
    order({ payment_status: 'pending' }), order({ order_status: 'cancelled' }),
    uber({ order_status: 'refunded' }), order({ payment_status: 'refunded' }),
  ]), { totalOrders: 0, totalNetSales: 0, totalCash: 0, totalCard: 0, totalMarketplace: 0 });
});

test('Completed respects zero payout and Report rounding across channels', () => {
  const inputs = [order({ total: 10.05 }), order({ total: 10.05 }), uber({ marketplace_gross_payout: 0 }), uber({ marketplace_gross_payout: 7.03 })];
  const reportTotal = buildChannelFinancialBreakdown(inputs).reduce((sum, row) => sum + (row.netSales ?? 0), 0);
  assert.equal(buildCompletedOrderStats(inputs).totalNetSales.toFixed(2), reportTotal.toFixed(2));
  assert.equal(buildCompletedOrderStats(inputs).totalNetSales, 24.42);
  assert.equal(buildCompletedOrderStats([uber({ marketplace_gross_payout: 0 })]).totalNetSales, 0);
});

test('Completed handles an empty day', () => {
  assert.deepEqual(buildCompletedOrderStats([]), { totalOrders: 0, totalNetSales: 0, totalCash: 0, totalCard: 0, totalMarketplace: 0 });
});
