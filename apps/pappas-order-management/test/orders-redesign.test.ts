import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fulfilmentTone, paymentTone, orderPaymentLabel, hasUpcomingOrders } from '../components/orders/presentation';

test('fulfilment readiness never implies that payment was collected', () => {
  assert.equal(fulfilmentTone('ready'), 'success');
  assert.equal(paymentTone('pending'), 'danger');
  assert.equal(fulfilmentTone('preparing'), 'warning');
  assert.equal(paymentTone('paid'), 'success');
  assert.equal(fulfilmentTone('cancelled'), 'danger');
  assert.equal(paymentTone('refunded'), 'neutral');
  assert.equal(orderPaymentLabel('pending', 'preparing'), 'Unpaid');
  assert.equal(orderPaymentLabel('pending', 'pending_online_payment'), 'Waiting for payment');
  assert.equal(orderPaymentLabel('refunded', 'completed'), 'Refunded');
});

test('conditional upcoming tab requires a confirmed or cached positive count', () => {
  assert.equal(hasUpcomingOrders(undefined), false);
  assert.equal(hasUpcomingOrders(0), false);
  assert.equal(hasUpcomingOrders(2), true);
  const source = readFileSync('components/navigation/OrdersWorkspaceHeader.tsx', 'utf8');
  assert.match(source, /data: upcomingCount \} = usePreOrderCountQuery/);
  assert.match(source, /hasUpcomingOrders\(upcomingCount\)/);
  assert.doesNotMatch(source, /upcomingCount\s*=\s*0/);
  assert.match(source, /label: 'Live'/);
  assert.match(source, /label: 'On the way'/);
  assert.match(source, /label: 'Completed'/);
});

test('preorders retains its route and details when its conditional tab disappears', () => {
  const source = readFileSync('app/(drawer)/pre-orders.tsx', 'utf8');
  assert.match(source, /<OrdersWorkspaceHeader/);
  assert.match(source, /<OrderDetailModal/);
  assert.doesNotMatch(source, /<Appbar.Header/);
  assert.doesNotMatch(source, /orders.length === 0.*router\./);
});
