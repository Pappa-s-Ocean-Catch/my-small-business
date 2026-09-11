import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order } from '@my-small-business/types';
import { getOrderPrintIntegrityWarning } from '../lib/order-print-integrity';

test('warns when persisted order totals do not reconcile with its items', () => {
  const warning = getOrderPrintIntegrityWarning({
    subtotal: 25,
    total: 25,
    tax: 0,
    delivery_fee: 0,
    service_fee: 0,
    promotion_discount: 0,
    coupon_discount: 0,
    reward_points_value: 0,
    items: [{ subtotal: 10, quantity: 1 }],
  } as Order);
  assert.equal(warning, 'WARNING: ORDER TOTAL DOES NOT MATCH ITEMS — CHECK BEFORE PREPARING');
});

test('accepts matching order and item totals', () => {
  assert.equal(getOrderPrintIntegrityWarning({
    subtotal: 25,
    total: 25,
    tax: 0,
    delivery_fee: 0,
    service_fee: 0,
    promotion_discount: 0,
    coupon_discount: 0,
    reward_points_value: 0,
    items: [{ subtotal: 10, quantity: 1 }, { subtotal: 15, quantity: 1 }],
  } as Order), null);
});

test('warns when marketplace gross sales differs from the represented POS total', () => {
  const warning = getOrderPrintIntegrityWarning({
    order_channel: 'third_party',
    marketplace_gross_sales: 25,
    subtotal: 20,
    total: 20,
    tax: 0,
    delivery_fee: 0,
    service_fee: 0,
    promotion_discount: 0,
    coupon_discount: 0,
    reward_points_value: 0,
    items: [{ subtotal: 20, quantity: 1 }],
  } as Order);

  assert.equal(warning, 'WARNING: ORDER TOTAL DOES NOT MATCH ITEMS — CHECK BEFORE PREPARING');
});

test('does not compare marketplace snapshots for store orders', () => {
  assert.equal(getOrderPrintIntegrityWarning({
    order_channel: 'instore',
    marketplace_gross_sales: 25,
    subtotal: 20,
    total: 20,
    tax: 0,
    delivery_fee: 0,
    service_fee: 0,
    promotion_discount: 0,
    coupon_discount: 0,
    reward_points_value: 0,
    items: [{ subtotal: 20, quantity: 1 }],
  } as Order), null);
});
