import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { createSettingsBackup, parseSettingsBackup } from './settings-backup';
import { DEFAULT_APP_SETTINGS, loadAppSettings, type AppSettings } from './settings';

const SETTINGS_BACKUP_FILE_NAME = 'pappas-pos-settings-v1.json';

export async function writeSettingsBackupFile(settings: AppSettings) {
  if (!FileSystem.cacheDirectory) throw new Error('Settings backup storage is unavailable');
  const fileUri = `${FileSystem.cacheDirectory}${SETTINGS_BACKUP_FILE_NAME}`;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(createSettingsBackup(settings), null, 2));
  return fileUri;
}

export async function writeSavedSettingsBackupFile() {
  return writeSettingsBackupFile(await loadAppSettings());
}

export async function pickSettingsBackup(): Promise<AppSettings | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;

  const contents = await FileSystem.readAsStringAsync(result.assets[0].uri);
  return {
    ...DEFAULT_APP_SETTINGS,
    ...parseSettingsBackup(contents),
  } as AppSettings;
}
