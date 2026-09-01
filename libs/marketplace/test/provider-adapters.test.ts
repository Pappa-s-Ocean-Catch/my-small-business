import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptUberDetail, adaptUberHistory } from '../src/uber-eats-adapter';
import { adaptDoorDashActive, adaptDoorDashDetail, adaptDoorDashHistory } from '../src/doordash-adapter';

test('Uber adapter converts Uber history rows without relying on DoorDash fields', () => {
  const result = adaptUberHistory({ data: { orders: [{ orderId: 'UE-1', workflowUuid: 'workflow-1', orderUuid: 'order-1', eater: { name: 'Uber customer' }, salesTotal: '$12.00' }] } });
  assert.deepEqual(result.orders, [{ orderId: 'UE-1', workflowUuid: 'workflow-1', orderUuid: 'order-1', customerName: 'Uber customer', salesTotal: '$12.00', netPayout: '', requestedAt: '', courierName: '', fulfillmentType: '', issueType: '', orderChannel: '', isSubscriber: false, subscriptionPass: '' }]);
});

test('DoorDash adapter converts DoorDash history rows without relying on Uber fields', () => {
  const result = adaptDoorDashHistory({ orders: [{ orderId: 'DD-1', deliveryUuid: 'delivery-1', consumer: { informalName: 'DoorDash customer' }, orderValue: { displayString: '$13.00' } }] }, 'history');
  assert.deepEqual(result.orders, [{ orderId: 'DD-1', workflowUuid: 'delivery-1', orderUuid: 'delivery-1', customerName: 'DoorDash customer', salesTotal: '$13.00', netPayout: '', requestedAt: '', courierName: '', fulfillmentType: '', issueType: '', orderChannel: 'DoorDash', isSubscriber: false, subscriptionPass: '' }]);
});

test('DoorDash adapter formats UTC list timestamps in Melbourne time', () => {
  const history = adaptDoorDashHistory({
    orders: [{
      orderId: 'DD-2',
      deliveryUuid: 'delivery-2',
      completedTime: '2026-08-25T08:00:00.000Z',
    }],
  }, 'history');
  const active = adaptDoorDashActive({
    orders: [{
      orderId: 'DD-2',
      deliveryUuid: 'delivery-2',
      pickupTime: '2026-08-25T08:00:00.000Z',
    }],
  });

  assert.equal(history.orders[0].requestedAt, '25 Aug 2026, 6:00 pm');
  assert.equal(active.orders[0].requestedAt, '25 Aug 2026, 6:00 pm');
});

test('DoorDash detail preserves the UTC instant used when creating a POS order', () => {
  const detail = adaptDoorDashDetail({
    orderId: 'DD-3',
    deliveryUuid: 'delivery-3',
    createdAt: '2026-08-26T09:03:08.000Z',
    orderDate: '2026-08-26T09:40:34',
  }, 'delivery-3');

  assert.equal(detail.requestedAt, Date.parse('2026-08-26T09:03:08.000Z'));
});

test('marketplace detail adapters expose only provider-scoped customer IDs', () => {
  const uber = adaptUberDetail({
    orderId: 'UE-2',
    orderUUID: 'uber-order-2',
    eater: { uuid: 'uber-eater-2', name: 'Uber customer' },
  }, 'uber-workflow-2');
  const doordash = adaptDoorDashDetail({
    orderId: 'DD-2',
    deliveryUuid: 'doordash-order-2',
    consumer: { consumerId: 'doordash-consumer-2', informalName: 'DoorDash customer' },
  }, 'doordash-workflow-2');

  assert.equal(uber.marketplaceCustomerId, 'uber-eater-2');
  assert.equal(doordash.marketplaceCustomerId, 'doordash-consumer-2');
  assert.notEqual(uber.marketplaceCustomerId, doordash.marketplaceCustomerId);
});

test('DoorDash active adapter preserves the prior active-order display mapping', () => {
  const result = adaptDoorDashActive({ orders: [{ orderId: 'DD-1', deliveryUuid: 'delivery-1', pickupTime: 'pickup', deliveryTime: 'delivery', orderSubStatus: { display: 'On the way' }, orderStatusDisplay: 'Confirmed', orderExperience: 'ignored' }] });
  assert.deepEqual(result.orders, [{ orderId: 'DD-1', workflowUuid: 'delivery-1', orderUuid: 'delivery-1', customerName: 'Customer', salesTotal: '', requestedAt: 'pickup', courierName: '', fulfillmentType: '', orderChannel: 'DoorDash', status: 'Confirmed', statusDescription: 'On the way' }]);
});
