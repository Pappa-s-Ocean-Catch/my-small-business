import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChannelFinancialBreakdown,
  findRemovableIngredientName,
  getMarketplaceOrderStatus,
  isMarketplaceImportDuplicateError,
  normalizeMarketplaceName,
} from '../lib/marketplace-pos-import';

const storeOrder = {
  order_channel: 'instore',
  delivery_partner_name: null,
  payment_status: 'paid',
  order_status: 'completed',
  total: 100,
  marketplace_gross_sales: null,
  marketplace_gross_payout: null,
} as const;

const uberOrder = {
  order_channel: 'third_party',
  delivery_partner_name: 'Uber Eats',
  payment_status: 'paid',
  order_status: 'completed',
  total: 95,
  marketplace_gross_sales: 100,
  marketplace_gross_payout: 70,
} as const;

const doordashOrder = {
  order_channel: 'third_party',
  delivery_partner_name: 'DoorDash',
  payment_status: 'paid',
  order_status: 'completed',
  total: 90,
  marketplace_gross_sales: 100,
  marketplace_gross_payout: 80,
} as const;

test('normalizes marketplace names before comparisons', () => {
  assert.equal(normalizeMarketplaceName('  Uber   Eats  '), 'uber eats');
});

test('matches No tomato to a removable Tomato without case sensitivity', () => {
  assert.equal(
    findRemovableIngredientName('No tomato', [{ name: 'Tomato', customerCanRemove: true }]),
    'Tomato'
  );
});

test('matches without modifier text to a removable ingredient', () => {
  assert.equal(
    findRemovableIngredientName('without TOMATO', [{ name: 'Tomato', customerCanRemove: true }]),
    'Tomato'
  );
});

test('does not remove a non-removable ingredient', () => {
  assert.equal(
    findRemovableIngredientName('without TOMATO', [{ name: 'Tomato', customerCanRemove: false }]),
    null
  );
});

test('maps marketplace terminal and kitchen states', () => {
  assert.equal(getMarketplaceOrderStatus('COMPLETED', null), 'completed');
  assert.equal(getMarketplaceOrderStatus('DELIVERED', null), 'completed');
  assert.equal(getMarketplaceOrderStatus('CANCELLED', null), 'cancelled');
  assert.equal(getMarketplaceOrderStatus('REFUNDED', null), 'refunded');
  assert.equal(getMarketplaceOrderStatus('READY_FOR_PICKUP', null), 'ready');
  assert.equal(getMarketplaceOrderStatus('PREPARING', null), 'preparing');
});

test('uses a marketplace status description when the state is otherwise unknown', () => {
  assert.equal(getMarketplaceOrderStatus('IN_PROGRESS', 'Refunded after delivery'), 'refunded');
  assert.equal(getMarketplaceOrderStatus('IN_PROGRESS', 'Customer cancelled'), 'cancelled');
  assert.equal(getMarketplaceOrderStatus('IN_PROGRESS', null), 'confirmed');
});

test('recognizes the marketplace duplicate database error', () => {
  assert.equal(
    isMarketplaceImportDuplicateError({ code: '23505', message: 'orders_unique_marketplace_import' }),
    true
  );
  assert.equal(
    isMarketplaceImportDuplicateError({ code: '23505', message: 'another_unique_index' }),
    false
  );
});

test('calculates finance by channel from marketplace snapshots', () => {
  assert.deepEqual(
    buildChannelFinancialBreakdown([storeOrder, uberOrder, doordashOrder]).map((row) => [
      row.label,
      row.orders,
      row.grossSales,
      row.grossPayout,
      row.commission,
      row.netSales,
    ]),
    [
      ['Store', 1, 100, null, null, 90],
      ['Uber Eats', 1, 100, 70, 30, 63],
      ['DoorDash', 1, 100, 80, 20, 72],
    ]
  );
});

test('falls back to POS total when a marketplace gross-sales snapshot is missing', () => {
  const [store, uber, doordash] = buildChannelFinancialBreakdown([
    { ...uberOrder, marketplace_gross_sales: null, total: 75 },
  ]);

  assert.equal(store.grossSales, 0);
  assert.equal(uber.grossSales, 75);
  assert.equal(doordash.grossSales, 0);
});

test('excludes unpaid, cancelled, and refunded orders from channel finance', () => {
  const rows = buildChannelFinancialBreakdown([
    { ...storeOrder, payment_status: 'pending' },
    { ...uberOrder, order_status: 'cancelled' },
    { ...doordashOrder, order_status: 'refunded' },
  ]);

  assert.equal(rows.reduce((count, row) => count + row.orders, 0), 0);
  assert.deepEqual(rows.map((row) => row.grossSales), [0, 0, 0]);
});
