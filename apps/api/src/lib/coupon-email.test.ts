import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's type-stripping runner needs the source extension.
import { handleCouponEmail } from './coupon-email.ts';

const couponId = '00000000-0000-0000-0000-000000000501';
function fixture() {
  const state = {
    user: { id: 'admin-1' } as { id: string } | null,
    role: 'admin',
    coupon: { id: couponId, code: 'GIFT-10', title: 'Thank you', discount_type: 'percent', discount_value: 10, is_active: true, starts_at: null, ends_at: null, max_uses: 1, usage_count: 0, max_uses_per_user: 1, user_id: 'customer-1', target_email: 'old@example.com', min_cart_subtotal: 0 } as any,
    target: { id: 'customer-1', full_name: 'Alex', email: 'alex@example.com' } as any,
    redemptions: 0,
    providerError: null as string | null,
    sent: [] as any[],
    reads: [] as string[],
  };
  const client = {
    auth: { getUser: async (token: string) => ({ data: { user: token === 'valid' ? state.user : null }, error: null }) },
    from: (table: string) => {
      state.reads.push(table); let id = '';
      const query: any = {
        select: () => query, ilike: () => query, limit: () => query,
        eq: (column: string, value: string) => { if (column === 'id') id = value; return query; },
        single: async () => ({ data: table === 'coupons' ? state.coupon : id === 'admin-1' ? { role_slug: state.role } : state.target, error: null }),
        then: (resolve: any) => Promise.resolve({ count: state.redemptions, error: null }).then(resolve),
      };
      query.maybeSingle = query.single;
      return query;
    },
  };
  const dependencies = {
    createClient: async () => client as any,
    sendEmail: async (payload: any) => { state.sent.push(payload); return state.providerError ? { success: false, error: state.providerError } : { success: true }; },
  };
  const request = (body: unknown = { couponId }, token: string | null = 'valid') => new Request('https://example.com/api/coupons/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { state, dependencies, request };
}

test('admin sends and resends the saved coupon to the saved profile email', async () => {
  const f = fixture();
  for (let i = 0; i < 2; i++) {
    const response = await handleCouponEmail(f.request({ couponId, email: 'attacker@example.com', code: 'FAKE' }), f.dependencies);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
  }
  assert.equal(f.state.sent.length, 2);
  assert.equal(f.state.sent[0].email, 'alex@example.com');
  assert.equal(f.state.sent[0].customerName, 'Alex');
  assert.equal(f.state.sent[0].coupon.code, 'GIFT-10');
});
test('staff, customer and invalid sessions cannot send or read coupons', async () => {
  for (const actor of ['staff', 'customer', 'invalid', 'missing']) {
    const f = fixture(); f.state.role = actor;
    const response = await handleCouponEmail(f.request({ couponId }, actor === 'missing' ? null : actor === 'invalid' ? 'bad' : 'valid'), f.dependencies);
    assert.equal(response.status, actor === 'missing' || actor === 'invalid' ? 401 : 403);
    assert.equal(f.state.sent.length, 0); assert.ok(!f.state.reads.includes('coupons'));
  }
});
test('inactive, expired, future and exhausted coupons cannot be emailed', async () => {
  for (const patch of [{ is_active: false }, { ends_at: '2000-01-01' }, { starts_at: '2999-01-01' }, { usage_count: 1 }, { discount_value: 0 }]) {
    const f = fixture(); Object.assign(f.state.coupon, patch);
    assert.equal((await handleCouponEmail(f.request(), f.dependencies)).status, 409);
    assert.equal(f.state.sent.length, 0);
  }
  const f = fixture(); f.state.redemptions = 1;
  assert.equal((await handleCouponEmail(f.request(), f.dependencies)).status, 409);
});
test('email-targeted coupons use saved target; coupons without recipients are rejected', async () => {
  const f = fixture(); f.state.coupon.user_id = null;
  assert.equal((await handleCouponEmail(f.request(), f.dependencies)).status, 200);
  assert.equal(f.state.sent[0].email, 'old@example.com');
  for (const target of [null, { full_name: 'Alex', email: null }]) {
    const g = fixture(); g.state.target = target;
    assert.equal((await handleCouponEmail(g.request(), g.dependencies)).status, 422);
    assert.equal(g.state.sent.length, 0);
  }
  f.state.coupon.target_email = null; f.state.sent = [];
  assert.equal((await handleCouponEmail(f.request(), f.dependencies)).status, 422);
  assert.equal(f.state.sent.length, 0);
});
test('bad request, missing coupon and provider failure are explicit failures', async () => {
  for (const body of [null, {}, { couponId: 12 }, { couponId: 'not-a-uuid' }]) {
    const f = fixture(); assert.equal((await handleCouponEmail(f.request(body), f.dependencies)).status, 400);
    assert.equal(f.state.sent.length, 0);
  }
  const f = fixture(); f.state.coupon = null;
  assert.equal((await handleCouponEmail(f.request(), f.dependencies)).status, 404);
  const g = fixture(); g.state.providerError = 'Email provider unavailable';
  const response = await handleCouponEmail(g.request(), g.dependencies);
  assert.equal(response.status, 502); assert.equal((await response.json()).success, false);
});

test('email-targeted coupon is not resent after recipient reaches the per-user limit', async () => {
  const f = fixture();
  Object.assign(f.state.coupon, { user_id: null, max_uses: 10, usage_count: 1 });
  f.state.redemptions = 1;
  assert.equal((await handleCouponEmail(f.request(), f.dependencies)).status, 409);
  assert.equal(f.state.sent.length, 0);
});
