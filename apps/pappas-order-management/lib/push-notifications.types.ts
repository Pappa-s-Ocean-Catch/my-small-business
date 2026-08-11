export type NotificationPermission = 'granted' | 'denied';

export interface NotificationClient {
  requestPermission(): Promise<NotificationPermission>;
  getExpoPushToken(projectId: string): Promise<string | null>;
}

export interface PushDeviceRecord {
  user_id: string;
  expo_push_token: string;
}

export interface PushDeviceStore {
  upsert(device: PushDeviceRecord): Promise<void>;
}

export interface PushRegistrationDependencies {
  notificationClient: NotificationClient;
  pushDeviceStore: PushDeviceStore;
  projectId: string;
}
