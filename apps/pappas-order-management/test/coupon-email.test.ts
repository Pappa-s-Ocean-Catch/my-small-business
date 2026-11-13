import assert from 'node:assert/strict';
import Module from 'node:module';
import test from 'node:test';
let token: string | null = 'admin-token';
let responseStatus = 200;
let calls: Array<{ url: string; options: RequestInit }> = [];
const originalLoad = (Module as any)._load;
(Module as any)._load = (request: string, parent: any, isMain: boolean) => {
  if (parent?.filename.endsWith('/lib/coupon-email.js')) {
    if (request === './supabase') return { supabase: { auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null }, error: null }) } } };
    if (request === '../utils/orderUtils') return { getApiUrl: (path: string) => `https://api.example.com${path}` };
  }
  return originalLoad(request, parent, isMain);
};
const { sendCouponEmail, canEmailCoupon } = require('../lib/coupon-email') as typeof import('../lib/coupon-email');
const originalFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = originalFetch; });
function setup() {
  token = 'admin-token'; responseStatus = 200; calls = [];
  globalThis.fetch = (async (url: string, options: RequestInit) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(responseStatus === 200 ? { success: true } : { success: false, error: 'Coupon expired' }), { status: responseStatus });
  }) as typeof fetch;
}
test('email client sends only coupon ID with authenticated bearer token', async () => {
  setup(); assert.equal((await sendCouponEmail('coupon-1')).success, true);
  assert.equal(calls[0].url, 'https://api.example.com/api/coupons/send-email');
  assert.deepEqual(JSON.parse(calls[0].options.body as string), { couponId: 'coupon-1' });
  assert.equal((calls[0].options.headers as Record<string, string>).Authorization, 'Bearer admin-token');
});
test('email client reports rejected, missing-session and unreachable-service failures', async () => {
  setup(); responseStatus = 409;
  assert.match((await sendCouponEmail('coupon-1')).error!, /expired/i);
  token = null; calls = [];
  assert.equal((await sendCouponEmail('coupon-1')).success, false); assert.equal(calls.length, 0);
  token = 'admin-token'; globalThis.fetch = async () => { throw new Error('Network unavailable'); };
  assert.equal((await sendCouponEmail('coupon-1')).success, false);
});
test('resend availability excludes inactive, future, expired, exhausted and public coupons', () => {
  const coupon = { is_active: true, starts_at: null, ends_at: null, max_uses: 1, usage_count: 0, max_uses_per_user: 1, user_id: 'customer-1' } as any;
  assert.equal(canEmailCoupon(coupon), true);
  for (const patch of [{ is_active: false }, { starts_at: '2999-01-01' }, { ends_at: '2000-01-01' }, { usage_count: 1 }, { max_uses_per_user: 0 }, { user_id: null }]) {
    assert.equal(canEmailCoupon({ ...coupon, ...patch }), false);
  }
});
