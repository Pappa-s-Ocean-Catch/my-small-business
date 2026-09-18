export type IdleMode = 'image' | 'queue';

export type MirrorSettings = {
  registerId: string;
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
  return {
    registerId: getString(candidate.registerId),
    idleMode: candidate.idleMode === 'queue' ? 'queue' : 'image',
    idleImageUri: typeof candidate.idleImageUri === 'string' && candidate.idleImageUri ? candidate.idleImageUri : undefined,
  };
}
