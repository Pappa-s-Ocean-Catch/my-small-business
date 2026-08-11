import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';
import {
  getOrderRouteFromNotificationData,
  registerOrderManagementPushDevice,
} from './push-notifications';
import type { NotificationClient } from './push-notifications.types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getProjectId(): string | null {
  return Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId
    ?? null;
}

const notificationClient: NotificationClient = {
  async requestPermission() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('new-orders', {
        name: 'New orders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return 'granted';

    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === 'granted' ? 'granted' : 'denied';
  },

  async getExpoPushToken(projectId) {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data || null;
  },
};

export async function registerExpoPushDeviceForStaff(userId: string): Promise<void> {
  const projectId = getProjectId();
  if (!projectId) {
    console.warn('[push] Expo project ID is unavailable; device registration skipped');
    return;
  }

  await registerOrderManagementPushDevice({
    notificationClient,
    projectId,
    pushDeviceStore: {
      async upsert(device) {
        const { error } = await supabase
          .from('order_management_push_devices')
          .upsert(device, { onConflict: 'expo_push_token' });

        if (error) throw error;
      },
    },
  }, userId);
}

export function subscribeToNewOrderNotificationResponses(
  onOrderRoute: (route: { pathname: '/order-detail'; params: { orderId: string } }) => void,
): () => void {
  const navigateFromResponse = (response: Notifications.NotificationResponse | null) => {
    const route = getOrderRouteFromNotificationData(response?.notification.request.content.data);
    if (route) onOrderRoute(route);
  };

  const subscription = Notifications.addNotificationResponseReceivedListener(navigateFromResponse);
  void Notifications.getLastNotificationResponseAsync()
    .then(navigateFromResponse)
    .catch((error) => console.warn('[push] notification response unavailable', error));

  return () => subscription.remove();
}
