export const SETTINGS_BACKUP_VERSION = 1;

export type SettingsBackup = {
  version: typeof SETTINGS_BACKUP_VERSION;
  exportedAt: string;
  settings: Record<string, unknown>;
};

export function createSettingsBackup(settings: Record<string, unknown>, exportedAt = new Date().toISOString()): SettingsBackup {
  return {
    version: SETTINGS_BACKUP_VERSION,
    exportedAt,
    settings,
  };
}

export function parseSettingsBackup(contents: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error('Invalid settings backup file');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid settings backup file');
  }

  const backup = parsed as Partial<SettingsBackup>;
  if (backup.version !== SETTINGS_BACKUP_VERSION) {
    throw new Error('Unsupported settings backup version');
  }
  if (!backup.settings || typeof backup.settings !== 'object' || Array.isArray(backup.settings)) {
    throw new Error('Invalid settings backup file');
  }
  return backup.settings;
}
