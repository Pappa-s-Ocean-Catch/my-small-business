import assert from 'node:assert/strict';
import test from 'node:test';
// Node's type-stripping test runner requires the source-file extension.
// @ts-expect-error TypeScript's app configuration intentionally disallows it.
import { getPendingCheckoutCancellationState, getPendingCheckoutOrderId } from './checkout-pending-order.ts';

test('uses Stripe’s order_id parameter to clean up a cancelled checkout', () => {
  const params = new URLSearchParams('canceled=true&order_id=order-from-stripe');

  assert.equal(getPendingCheckoutOrderId(params, 'stale-local-order'), 'order-from-stripe');
});

test('uses the locally stored order ID when Stripe has no order ID in the return URL', () => {
  assert.equal(getPendingCheckoutOrderId(new URLSearchParams('canceled=true'), 'stored-order'), 'stored-order');
});

test('treats a missing pending order as already cancelled', () => {
  assert.equal(getPendingCheckoutCancellationState(null), 'already-cancelled');
});
