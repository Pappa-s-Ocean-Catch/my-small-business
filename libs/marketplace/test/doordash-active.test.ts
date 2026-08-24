import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDoorDashActivePayload, normalizeDoorDashActiveOrders } from '../src/doordash-active';

test('builds DoorDash active payload from provider configuration', () => {
  assert.deepEqual(buildDoorDashActivePayload({ businessId: '12', storeId: 34 }).storeIds, [34]);
});

test('normalizes DoorDash delivery UUID as both identifiers', () => {
  assert.deepEqual(normalizeDoorDashActiveOrders([{ orderId: 'DD-1', deliveryUuid: 'delivery-1' }]), [{
    orderId: 'DD-1', workflowUuid: 'delivery-1', orderUuid: 'delivery-1', customerName: 'Customer', salesTotal: '', requestedAt: '', courierName: '', fulfillmentType: '', orderChannel: 'DoorDash', status: 'Active', statusDescription: '',
  }]);
});
