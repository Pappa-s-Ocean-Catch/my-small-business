import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'pappas-order-management.print-device-id.v1';

let cachedDeviceId: string | null = null;

function newDeviceId() {
  return `pos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getPrintDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored) {
    cachedDeviceId = stored;
    return stored;
  }

  const created = newDeviceId();
  await AsyncStorage.setItem(STORAGE_KEY, created);
  cachedDeviceId = created;
  return created;
}
