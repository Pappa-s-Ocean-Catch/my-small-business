import assert from 'node:assert/strict';
import Module from 'node:module';
import test from 'node:test';

const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { renderHook, act, waitFor, cleanup } = require('@testing-library/react');
let listener: (event: string, session: any) => void;
let user: { id: string } | null = { id: 'admin-1' };
let permissionCheck = async () => true;
const originalLoad = (Module as any)._load;
(Module as any)._load = (request: string, parent: any, isMain: boolean) => {
  if (parent?.filename.endsWith('/hooks/useCouponAdmin.js')) {
    if (request === '@/lib/auth') return { isAdminUser: () => permissionCheck() };
    if (request === '@/lib/supabase') return { supabase: { auth: {
      getUser: async () => ({ data: { user } }),
      onAuthStateChange: (callback: typeof listener) => {
        listener = callback;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    } } };
  }
  return originalLoad(request, parent, isMain);
};
const { useCouponAdmin } = require('../hooks/useCouponAdmin') as typeof import('../hooks/useCouponAdmin');

test('same-admin token refresh preserves access until permission is actually denied', async () => {
  user = { id: 'admin-1' }; permissionCheck = async () => true;
  const hook = renderHook(() => useCouponAdmin());
  try {
    await waitFor(() => assert.equal(hook.result.current, true));
    let resolveCheck!: (allowed: boolean) => void;
    permissionCheck = () => new Promise<boolean>(resolve => { resolveCheck = resolve; });
    await act(async () => {
      listener('TOKEN_REFRESHED', { user });
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    assert.equal(hook.result.current, true, 'background refresh must not close the coupon editor');
    await act(async () => { resolveCheck(false); });
    await waitFor(() => assert.equal(hook.result.current, false));
  } finally { hook.unmount(); cleanup(); }
});

test('account changes revoke the previous admin access immediately', async () => {
  user = { id: 'admin-1' }; permissionCheck = async () => true;
  const hook = renderHook(() => useCouponAdmin());
  try {
    await waitFor(() => assert.equal(hook.result.current, true));
    permissionCheck = async () => false;
    user = { id: 'staff-1' };
    act(() => { listener('SIGNED_IN', { user }); });
    assert.equal(hook.result.current, false);
    user = null;
    act(() => { listener('SIGNED_OUT', null); });
    assert.equal(hook.result.current, false);
  } finally { hook.unmount(); cleanup(); }
});
