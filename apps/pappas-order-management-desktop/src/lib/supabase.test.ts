import { describe, expect, it } from 'vitest';
import { createSupabaseSessionStorage } from './supabase';

describe('desktop Supabase session storage', () => {
  it('keeps a session in memory when native secure storage is unavailable', async () => {
    const storage = createSupabaseSessionStorage({
      get: async () => ({ ok: true, value: null }),
      set: async () => ({ ok: false, code: 'SECURE_STORE_UNAVAILABLE', message: 'Secure storage is unavailable on this computer.' }),
      remove: async () => ({ ok: true, value: undefined }),
    });

    await storage.setItem('supabase.auth.token', 'session');
    await expect(storage.getItem('supabase.auth.token')).resolves.toBe('session');
  });
});
