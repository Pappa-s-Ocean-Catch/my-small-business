import type { PlatformResult, PosSecureStore, PosSecureStoreKey } from '@my-small-business/pos-domain';

export type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

const unavailable = <T>(): PlatformResult<T> => ({
  ok: false,
  code: 'SECURE_STORE_UNAVAILABLE',
  message: 'Secure storage is unavailable on this computer.',
});

async function call<T>(invoke: Invoke, command: string, args?: Record<string, unknown>): Promise<PlatformResult<T>> {
  try {
    return { ok: true, value: await invoke(command, args) as T };
  } catch {
    return unavailable<T>();
  }
}

export function createDesktopSecureStore(invoke: Invoke): PosSecureStore {
  return {
    get(key: PosSecureStoreKey): Promise<PlatformResult<string | null>> {
      if (key === 'supabase-session') return call(invoke, 'session_get');
      return call<{ id?: string; name?: string } | null>(invoke, 'register_get').then((result) => {
        if (!result.ok) return unavailable<string | null>();
        if (result.value === null) return { ok: true, value: null };
        const value = result.value;
        return { ok: true, value: key === 'register-id' ? value.id ?? null : value.name ?? null };
      });
    },
    set(key, value): Promise<PlatformResult<void>> {
      if (key === 'supabase-session') return call<void>(invoke, 'session_set', { value });
      return call<void>(invoke, 'register_set', key === 'register-id' ? { id: value } : { name: value });
    },
    remove(): Promise<PlatformResult<void>> {
      return call<void>(invoke, 'session_clear');
    },
  };
}
