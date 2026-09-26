import { describe, expect, it } from 'vitest';
import { createDesktopSecureStore } from './secure-store';

describe('desktop secure store', () => {
  it('returns typed signed-out state when secure storage is unavailable', async () => {
    const store = createDesktopSecureStore(async () => { throw new Error('keychain unavailable'); });

    await expect(store.get('supabase-session')).resolves.toEqual({
      ok: false,
      code: 'SECURE_STORE_UNAVAILABLE',
      message: 'Secure storage is unavailable on this computer.',
    });
  });

  it('uses fixed commands for session and register values', async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
    const store = createDesktopSecureStore(async (command, args) => {
      calls.push({ command, args });
      return command === 'session_get' ? 'serialized-session' : undefined;
    });

    await expect(store.get('supabase-session')).resolves.toEqual({ ok: true, value: 'serialized-session' });
    await expect(store.set('register-name', 'Front counter')).resolves.toEqual({ ok: true, value: undefined });
    await expect(store.remove('supabase-session')).resolves.toEqual({ ok: true, value: undefined });
    expect(calls).toEqual([
      { command: 'session_get', args: undefined },
      { command: 'register_set', args: { id: undefined, name: 'Front counter' } },
      { command: 'session_clear', args: undefined },
    ]);
  });
});
