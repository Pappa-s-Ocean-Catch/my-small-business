import assert from 'node:assert/strict';
import test from 'node:test';

import { getEditedOrderPaymentAction } from '../lib/edit-order-payment';

test('routes edited orders to the selected payment flow before saving', () => {
  assert.deepEqual(getEditedOrderPaymentAction('cash'), { kind: 'cash_tender' });
  assert.deepEqual(getEditedOrderPaymentAction('card'), { kind: 'checkout', payment: 'card' });
  assert.deepEqual(getEditedOrderPaymentAction('smartpay'), { kind: 'checkout', payment: 'smartpay' });
  assert.deepEqual(getEditedOrderPaymentAction('unpaid'), { kind: 'checkout', payment: 'no_pay' });
});
