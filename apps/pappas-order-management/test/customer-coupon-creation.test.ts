import assert from 'node:assert/strict';
import Module from 'node:module';
import test from 'node:test';

let role = 'admin';
let signedIn = true;
let databaseError: { code?: string; message: string } | null = null;
let inserted: any = null;
let profileCreated = false;
let emailCalls = 0;
let deliveryError: string | null = null;
const originalLoad = (Module as any)._load;
(Module as any)._load = (request: string, parent: any, isMain: boolean) => {
  if (parent?.filename.endsWith('/lib/customer-coupon.js')) {
    if (request === './supabase') return { supabase: {
      auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'actor' } : null }, error: null }) },
      from: (table: string) => {
        const query: any = {
          select: () => query, eq: () => query,
          insert: (payload: any) => { inserted = payload; return query; },
          single: async () => table === 'profiles'
            ? { data: { role_slug: role }, error: null }
            : { data: databaseError ? null : { id: 'new-coupon', ...inserted }, error: databaseError },
        };
        return query;
      },
    } };
    if (request === './coupon-email') return { sendCouponEmail: async () => { emailCalls++; return deliveryError ? { success: false, error: deliveryError } : { success: true }; } };
    if (request === './customers') return { createCustomerIfNotExists: async () => {
      profileCreated = true;
      return { data: { id: 'phone-profile' }, error: null };
    } };
  }
  return originalLoad(request, parent, isMain);
};
// Require dynamically so the external Supabase boundary is installed first.
const { createCustomerCoupon } = require('../lib/customer-coupon') as { createCustomerCoupon: (input: unknown) => Promise<Awaited<ReturnType<typeof import('../lib/customer-coupon').createCustomerCoupon>> & { emailSent?: boolean; emailError?: string }> };
const input = () => ({ code: ' save10 ', title: ' Thank you ', discountType: 'percent', discountValue: '10', customer: { profileId: 'customer-1', name: 'Alex' } });
function reset() { role = 'admin'; signedIn = true; databaseError = null; inserted = null; profileCreated = false; emailCalls = 0; deliveryError = null; }

test('admin issues a one-use percentage coupon restricted to the selected profile', async () => {
  reset();
  const result = await createCustomerCoupon(input());
  assert.equal(result.error, null);
  assert.equal((result.data as any).id, 'new-coupon');
  assert.equal(inserted.code, 'SAVE10');
  assert.equal(inserted.title, 'Thank you');
  assert.equal(inserted.discount_type, 'percent');
  assert.equal(inserted.discount_value, 10);
  assert.equal(inserted.user_id, 'customer-1');
  assert.equal(inserted.target_email, null);
  assert.equal(inserted.max_uses, 1);
  assert.equal(inserted.max_uses_per_user, 1);
});
test('fixed coupon supports cents and email-only customers', async () => {
  reset();
  const result = await createCustomerCoupon({ ...input(), discountType: 'fixed', discountValue: '12.50', customer: { email: ' Alex@Example.com ' } });
  assert.equal(result.error, null);
  assert.equal(inserted.discount_value, 12.5);
  assert.equal(inserted.discount_type, 'fixed');
  assert.equal(inserted.target_email, 'alex@example.com');
});
test('phone-only customer gets a profile target instead of a public coupon', async () => {
  reset();
  const result = await createCustomerCoupon({ ...input(), customer: { name: 'Alex', phone: '0412345678' } });
  assert.equal(result.error, null);
  assert.equal(profileCreated, true);
  assert.equal(inserted.user_id, 'phone-profile');
});
test('staff and anonymous sessions cannot issue coupons or create target profiles', async () => {
  for (const actor of ['staff', 'anonymous']) {
    reset(); role = actor; signedIn = actor !== 'anonymous';
    const result = await createCustomerCoupon({ ...input(), customer: { phone: '0412345678' } });
    assert.ok(result.error);
    assert.equal(inserted, null);
    assert.equal(profileCreated, false);
  }
});
test('invalid values and missing targets never insert a coupon', async () => {
  for (const patch of [
    { discountValue: '0' }, { discountValue: '-1' }, { discountValue: '101' },
    { discountValue: 'NaN' }, { discountValue: 'Infinity' }, { discountValue: '' },
    { discountValue: '1.001' }, { discountType: 'invalid' }, { customer: {} },
    { customer: null }, { code: '' }, { title: '' }, { code: 'SAVE%10' },
  ]) {
    reset();
    assert.ok((await createCustomerCoupon({ ...input(), ...patch })).error, JSON.stringify(patch));
    assert.equal(inserted, null);
  }
});
test('100 percent is valid and fixed amounts can exceed 100', async () => {
  for (const patch of [{ discountValue: '100' }, { discountType: 'fixed', discountValue: '150' }]) {
    reset(); assert.equal((await createCustomerCoupon({ ...input(), ...patch })).error, null);
  }
});
test('duplicate codes and permission failures return visible errors without success', async () => {
  for (const error of [{ code: '23505', message: 'duplicate key' }, { code: '42501', message: 'permission denied' }]) {
    reset(); databaseError = error;
    const result = await createCustomerCoupon(input());
    assert.equal(result.data, null);
    assert.ok(result.error);
    if (error.code === '23505') assert.match(result.error!, /code.*already/i);
  }
});

test('creation emails only when checkbox is selected', async () => {
  reset(); await createCustomerCoupon(input()); assert.equal(emailCalls, 0);
  const result = await createCustomerCoupon({ ...input(), sendEmail: true });
  assert.equal(result.error, null); assert.equal(result.emailSent, true); assert.equal(emailCalls, 1);
});
test('email failure preserves the created coupon and reports a separate delivery error', async () => {
  reset(); deliveryError = 'Provider unavailable';
  const result = await createCustomerCoupon({ ...input(), sendEmail: true });
  assert.equal(result.error, null); assert.equal(result.data?.id, 'new-coupon');
  assert.equal(result.emailSent, false); assert.equal(result.emailError, 'Provider unavailable');
});
