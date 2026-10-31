// Reserved selection value; existing single-register settings remain valid.
export const ALL_REGISTERS = '*';

export type IdleMode = 'image' | 'queue';

export type MirrorSettings = {
  registerId: string;
  registerIds?: string[];
  idleMode: IdleMode;
  idleImageUri?: string;
};

export const DEFAULT_MIRROR_SETTINGS: MirrorSettings = {
  registerId: '',
  idleMode: 'image',
};

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeMirrorSettings(value: unknown): MirrorSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_MIRROR_SETTINGS;
  }

  const candidate = value as Record<string, unknown>;
  const registerIds = Array.isArray(candidate.registerIds)
    ? [...new Set(candidate.registerIds.map(getString).filter(Boolean))] : undefined;
  const normalizedIds = registerIds?.includes(ALL_REGISTERS) ? [ALL_REGISTERS] : registerIds;
  return {
    registerId: normalizedIds ? normalizedIds[0] ?? '' : getString(candidate.registerId),
    ...(normalizedIds ? { registerIds: normalizedIds } : {}),
    idleMode: candidate.idleMode === 'queue' ? 'queue' : 'image',
    idleImageUri: typeof candidate.idleImageUri === 'string' && candidate.idleImageUri ? candidate.idleImageUri : undefined,
  };
}

export function selectedRegisters(settings: MirrorSettings): string[] {
  return settings.registerIds ?? (settings.registerId ? [settings.registerId] : []);
}
