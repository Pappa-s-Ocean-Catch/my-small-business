import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_MIRROR_SETTINGS,
  normalizeMirrorSettings,
  type MirrorSettings,
} from './mirror-settings';

const STORAGE_KEY = 'pos-mirror.settings.v1';

export async function loadMirrorSettings(): Promise<MirrorSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_MIRROR_SETTINGS;

  try {
    return normalizeMirrorSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_MIRROR_SETTINGS;
  }
}

export async function saveMirrorSettings(settings: MirrorSettings): Promise<MirrorSettings> {
  const normalized = normalizeMirrorSettings(settings);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
