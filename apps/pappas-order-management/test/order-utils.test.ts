import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order } from '@my-small-business/types';
import { formatOrderPaymentMethod, getPaymentStatType, getReceiptHeader } from '../utils/orderUtils';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    order_number: 'ORD-001',
    order_channel: 'instore',
    payment_method: 'store',
    payment_method_detail: 'cash',
    ...overrides,
  } as Order;
}

test('classifies marketplace orders before their cash-like payment fields', () => {
  assert.equal(
    getPaymentStatType(makeOrder({
      order_channel: 'third_party',
      delivery_partner_name: 'Uber Eats',
      payment_method: 'store',
      payment_method_detail: 'cash',
    })),
    'marketplace'
  );
  assert.equal(
    getPaymentStatType(makeOrder({
      order_channel: 'third_party',
      delivery_partner_name: 'DoorDash',
      payment_method: 'store',
      payment_method_detail: null,
    })),
    'marketplace'
  );
});

test('retains direct card and cash classifications', () => {
  assert.equal(getPaymentStatType(makeOrder({ payment_method: 'online' })), 'card');
  assert.equal(getPaymentStatType(makeOrder()), 'cash');
});

test('prefers the recorded payment detail when displaying a paid order method', () => {
  assert.equal(formatOrderPaymentMethod(makeOrder({ payment_method: 'store', payment_method_detail: 'smartpay' })), 'Smartpay');
  assert.equal(formatOrderPaymentMethod(makeOrder({ payment_method: 'online', payment_method_detail: null })), 'Online');
  assert.equal(formatOrderPaymentMethod(makeOrder({ payment_method: undefined, payment_method_detail: null })), 'Not recorded');
});

test('maps supported marketplace partners to a branded delivery receipt header', () => {
  assert.deepEqual(
    getReceiptHeader(makeOrder({
      order_channel: 'third_party',
      delivery_partner_name: 'Uber Eats',
      order_type: 'pickup',
    })),
    { label: 'DELIVERY', logo: 'uber_eats' }
  );
  assert.deepEqual(
    getReceiptHeader(makeOrder({
      order_channel: 'third_party',
      delivery_partner_name: 'DoorDash',
      order_type: 'pickup',
    })),
    { label: 'DELIVERY', logo: 'doordash' }
  );
});

test('maps direct order channels to receipt labels without a logo', () => {
  assert.deepEqual(
    getReceiptHeader(makeOrder({ order_channel: 'instore' })),
    { label: 'INSTORE', logo: null }
  );
  assert.deepEqual(
    getReceiptHeader(makeOrder({ order_channel: 'phone_pickup' })),
    { label: 'PHONE PICKUP', logo: null }
  );
  assert.deepEqual(
    getReceiptHeader(makeOrder({ order_channel: 'phone_delivery' })),
    { label: 'PHONE DELIVERY', logo: null }
  );
});
