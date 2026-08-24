import assert from 'node:assert/strict';
import test from 'node:test';

import { buildUberActivePayload, normalizeUberActiveOrders } from '../src/uber-active';

test('builds Uber active payload from the selected restaurant cookie', () => {
  assert.deepEqual(buildUberActivePayload('a=1; selectedRestaurant=restaurant-1; b=2').filters.locationConstraints.locationUuids, ['restaurant-1']);
});

test('normalizes the workflow and order UUIDs separately', () => {
  assert.deepEqual(normalizeUberActiveOrders([{ orderId: 'UE-1', workflowUUID: 'workflow-1', orderUUID: 'order-1' }]), [{
    orderId: 'UE-1', workflowUuid: 'workflow-1', orderUuid: 'order-1', customerName: 'Customer', salesTotal: '', requestedAt: '', courierName: '', fulfillmentType: '', orderChannel: '', status: 'Active', statusDescription: '',
  }]);
});
