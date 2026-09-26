import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PosSecureStore } from '@my-small-business/pos-domain';

export function createSupabaseSessionStorage(secureStore: PosSecureStore) {
  let inMemorySession: string | null = null;
  let warnedAboutNativeStorage = false;
  const warnAboutFallback = (message: string) => {
    if (!warnedAboutNativeStorage) {
      warnedAboutNativeStorage = true;
      console.warn('[desktop-pos/auth] native secure storage unavailable; using memory-only session', { message });
    }
  };
  return {
    getItem: async (_key: string) => {
      const result = await secureStore.get('supabase-session');
      if (!result.ok) {
        warnAboutFallback(result.message);
        return inMemorySession;
      }
      return result.value ?? inMemorySession;
    },
    setItem: async (_key: string, value: string) => {
      inMemorySession = value;
      const result = await secureStore.set('supabase-session', value);
      if (!result.ok) warnAboutFallback(result.message);
    },
    removeItem: async (_key: string) => {
      inMemorySession = null;
      const result = await secureStore.remove('supabase-session');
      if (!result.ok) warnAboutFallback(result.message);
    },
  };
}

export function createDesktopSupabaseClient(
  secureStore: PosSecureStore,
  env: { EXPO_PUBLIC_SUPABASE_URL?: string; EXPO_PUBLIC_SUPABASE_ANON_KEY?: string },
): SupabaseClient {
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.');

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: createSupabaseSessionStorage(secureStore),
    },
  });
}
