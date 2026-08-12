import test from 'node:test';
import assert from 'node:assert/strict';
import { getPaymentStatusUpdatePayload } from '../lib/order-payment-status';

test('confirms a pending online checkout when staff records a successful payment', () => {
  assert.deepEqual(
    getPaymentStatusUpdatePayload('pending_online_payment', 'paid', 'SmartPay'),
    {
      order_status: 'confirmed',
      payment_status: 'paid',
      payment_method_detail: 'SmartPay',
    },
  );
});

test('does not change the workflow status for a normal payment update', () => {
  assert.deepEqual(
    getPaymentStatusUpdatePayload('preparing', 'paid', 'Card'),
    {
      payment_status: 'paid',
      payment_method_detail: 'Card',
    },
  );
});
