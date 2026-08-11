import type { PushRegistrationDependencies } from './push-notifications.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function registerOrderManagementPushDevice(
  dependencies: PushRegistrationDependencies,
  userId: string,
): Promise<void> {
  try {
    const permission = await dependencies.notificationClient.requestPermission();
    if (permission !== 'granted') return;

    const expoPushToken = await dependencies.notificationClient.getExpoPushToken(dependencies.projectId);
    if (!expoPushToken) return;

    await dependencies.pushDeviceStore.upsert({
      user_id: userId,
      expo_push_token: expoPushToken,
    });
  } catch (error) {
    console.warn('[push] device registration skipped', error);
  }
}

export function getOrderIdFromNotificationData(data: unknown): string | null {
  if (!isRecord(data) || data.eventType !== 'new_order' || typeof data.orderId !== 'string') {
    return null;
  }

  return UUID_PATTERN.test(data.orderId) ? data.orderId : null;
}

export function getOrderRouteFromNotificationData(data: unknown): {
  pathname: '/order-detail';
  params: { orderId: string };
} | null {
  const orderId = getOrderIdFromNotificationData(data);
  if (!orderId) return null;

  return {
    pathname: '/order-detail',
    params: { orderId },
  };
}
