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
