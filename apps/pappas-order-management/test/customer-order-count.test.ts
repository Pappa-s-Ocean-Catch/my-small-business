import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSuccessfulOrderCount, getSuccessfulOrderCounts } from '../utils/customer-order-count';

test('counts only paid non-cancelled orders using profile identity before legacy contact matching', () => {
  const counts = getSuccessfulOrderCounts(
    [
      { id: 'visible-profile', user_id: 'profile-1', customer_email: 'same@example.com', customer_phone: '0400000000' },
      { id: 'visible-legacy', user_id: null, customer_email: 'legacy@example.com', customer_phone: '0411111111' },
    ],
    [
      { id: 'profile-paid', user_id: 'profile-1', customer_email: 'same@example.com', customer_phone: '0400000000', payment_status: 'paid', order_status: 'completed' },
      { id: 'profile-legacy-paid', user_id: null, customer_email: 'same@example.com', customer_phone: '0400000000', payment_status: 'paid', order_status: 'completed' },
      { id: 'other-profile-same-contact', user_id: 'profile-2', customer_email: 'same@example.com', customer_phone: '0400000000', payment_status: 'paid', order_status: 'completed' },
      { id: 'profile-refunded', user_id: 'profile-1', customer_email: 'same@example.com', customer_phone: '0400000000', payment_status: 'refunded', order_status: 'refunded' },
      { id: 'profile-cancelled', user_id: 'profile-1', customer_email: 'same@example.com', customer_phone: '0400000000', payment_status: 'paid', order_status: 'cancelled' },
      { id: 'profile-unpaid', user_id: 'profile-1', customer_email: 'same@example.com', customer_phone: '0400000000', payment_status: 'pending', order_status: 'completed' },
      { id: 'legacy-paid', user_id: null, customer_email: 'legacy@example.com', customer_phone: '0411111111', payment_status: 'paid', order_status: 'completed' },
      { id: 'legacy-cancelled', user_id: null, customer_email: 'legacy@example.com', customer_phone: '0411111111', payment_status: 'paid', order_status: 'cancelled' },
    ],
  );

  assert.deepEqual(counts, {
    'visible-profile': 2,
    'visible-legacy': 1,
  });
});

test('formats successful order count for receipt output', () => {
  assert.equal(formatSuccessfulOrderCount(1), '1 successful order');
  assert.equal(formatSuccessfulOrderCount(4), '4 successful orders');
});
