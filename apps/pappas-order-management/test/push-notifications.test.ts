import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getOrderIdFromNotificationData,
  getOrderRouteFromNotificationData,
  registerOrderManagementPushDevice,
} from '../lib/push-notifications';
import type { NotificationClient, PushDeviceStore } from '../lib/push-notifications.types';

function createNotificationClient(options: {
  permission: 'granted' | 'denied';
  token: string | null;
}): NotificationClient {
  return {
    requestPermission: async () => options.permission,
    getExpoPushToken: async () => options.token,
  };
}

test('records an Expo token for a signed-in staff device', async () => {
  const upserts: Array<{ user_id: string; expo_push_token: string }> = [];
  const pushDeviceStore: PushDeviceStore = {
    upsert: async (device) => {
      upserts.push(device);
    },
  };

  await registerOrderManagementPushDevice({
    notificationClient: createNotificationClient({
      permission: 'granted',
      token: 'ExponentPushToken[test]',
    }),
    pushDeviceStore,
    projectId: 'project-id',
  }, 'staff-id');

  assert.deepEqual(upserts, [{
    user_id: 'staff-id',
    expo_push_token: 'ExponentPushToken[test]',
  }]);
});

test('swallows notification registration failures so order management remains usable', async () => {
  const pushDeviceStore: PushDeviceStore = {
    upsert: async () => {
      throw new Error('offline');
    },
  };

  await assert.doesNotReject(() => registerOrderManagementPushDevice({
    notificationClient: createNotificationClient({ permission: 'denied', token: null }),
    pushDeviceStore,
    projectId: 'project-id',
  }, 'staff-id'));
});

test('accepts only a well-formed new-order notification order ID', () => {
  const orderId = 'a0d7f897-b2c3-4b4e-90cf-67f259346ae2';

  assert.equal(getOrderIdFromNotificationData({ eventType: 'new_order', orderId }), orderId);
  assert.equal(getOrderIdFromNotificationData({ eventType: 'new_order', orderId: '<script>' }), null);
  assert.equal(getOrderIdFromNotificationData({ eventType: 'other', orderId }), null);
});

test('maps a valid notification response to the order detail route', () => {
  assert.deepEqual(
    getOrderRouteFromNotificationData({
      eventType: 'new_order',
      orderId: 'a0d7f897-b2c3-4b4e-90cf-67f259346ae2',
    }),
    {
      pathname: '/order-detail',
      params: { orderId: 'a0d7f897-b2c3-4b4e-90cf-67f259346ae2' },
    },
  );
});
