import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order } from '@my-small-business/types';
import {
  getInstoreCustomerReceiptPrintJob,
  isInstoreCustomerReceiptAutoPrintEligible,
  normalizeInstoreCustomerReceiptSettings,
} from '../lib/instore-customer-receipt';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    order_number: 'ORD-001',
    order_channel: 'instore',
    payment_method: 'store',
    payment_method_detail: 'Cash',
    payment_status: 'paid',
    ...overrides,
  } as Order;
}

const enabledSettings = {
  instoreCustomerReceiptAutoPrintEnabled: true,
  instoreCustomerReceiptPrinterTarget: 'tcp:192.168.1.20:9100',
  instoreCustomerReceiptEnabledFromTime: '17:00',
  instoreCustomerReceiptEnabledToTime: '20:00',
};

test('defaults automatic in-store customer receipts to disabled with no printer or time window', () => {
  assert.deepEqual(normalizeInstoreCustomerReceiptSettings(null), {
    instoreCustomerReceiptAutoPrintEnabled: false,
    instoreCustomerReceiptPrinterTarget: null,
    instoreCustomerReceiptEnabledFromTime: null,
    instoreCustomerReceiptEnabledToTime: null,
  });
});

test('only permits paid POS instore cash, card, and SmartPay orders during the configured time window', () => {
  const inWindow = new Date(2026, 7, 8, 18, 0, 0);
  assert.equal(isInstoreCustomerReceiptAutoPrintEligible(makeOrder(), enabledSettings, inWindow), true);
  assert.equal(isInstoreCustomerReceiptAutoPrintEligible(makeOrder({ payment_method_detail: 'Card' }), enabledSettings, inWindow), true);
  assert.equal(isInstoreCustomerReceiptAutoPrintEligible(makeOrder({ payment_method_detail: 'SmartPay' }), enabledSettings, inWindow), true);
  assert.equal(isInstoreCustomerReceiptAutoPrintEligible(makeOrder({ order_channel: 'phone_pickup' }), enabledSettings, inWindow), false);
  assert.equal(isInstoreCustomerReceiptAutoPrintEligible(makeOrder({ order_channel: 'third_party' }), enabledSettings, inWindow), false);
  assert.equal(isInstoreCustomerReceiptAutoPrintEligible(makeOrder({ payment_status: 'pending' }), enabledSettings, inWindow), false);
  assert.equal(isInstoreCustomerReceiptAutoPrintEligible(makeOrder({ payment_method_detail: 'Bank transfer' }), enabledSettings, inWindow), false);
  assert.equal(isInstoreCustomerReceiptAutoPrintEligible(makeOrder(), enabledSettings, new Date(2026, 7, 8, 20, 0, 0)), false);
});

test('supports all-day and overnight receipt time windows', () => {
  assert.equal(isInstoreCustomerReceiptAutoPrintEligible(makeOrder(), {
    ...enabledSettings,
    instoreCustomerReceiptEnabledFromTime: null,
    instoreCustomerReceiptEnabledToTime: null,
  }, new Date(2026, 7, 8, 8, 0, 0)), true);
  assert.equal(isInstoreCustomerReceiptAutoPrintEligible(makeOrder(), {
    ...enabledSettings,
    instoreCustomerReceiptEnabledFromTime: '20:00',
    instoreCustomerReceiptEnabledToTime: '06:00',
  }, new Date(2026, 7, 8, 2, 0, 0)), true);
});

test('builds one priority customer-copy job only when the configured printer is saved', () => {
  assert.deepEqual(getInstoreCustomerReceiptPrintJob(makeOrder(), enabledSettings, [
    'tcp:192.168.1.20:9100',
  ], new Date(2026, 7, 8, 18, 0, 0)), {
    printerTarget: 'tcp:192.168.1.20:9100',
    template: 'customer-copy',
    priority: 'customer-receipt',
    copies: 1,
  });
  assert.equal(getInstoreCustomerReceiptPrintJob(makeOrder(), enabledSettings, [], new Date(2026, 7, 8, 18, 0, 0)), null);
});
