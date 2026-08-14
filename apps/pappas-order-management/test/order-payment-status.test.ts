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

test('keeps a pending online checkout non-printable when payment remains pending', () => {
  assert.deepEqual(
    getPaymentStatusUpdatePayload('pending_online_payment', 'pending', 'SmartPay'),
    {
      payment_status: 'pending',
      payment_method_detail: 'SmartPay',
    },
  );
});

test('keeps a pending online checkout non-printable when payment fails', () => {
  assert.deepEqual(
    getPaymentStatusUpdatePayload('pending_online_payment', 'failed', 'SmartPay'),
    {
      payment_status: 'failed',
      payment_method_detail: 'SmartPay',
    },
  );
});
