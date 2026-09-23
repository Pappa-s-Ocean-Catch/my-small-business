import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('POS save and edit each use one atomic database mutation', () => {
  const source = readFileSync(resolve(process.cwd(), 'lib/orders.ts'), 'utf8');
  const save = source.slice(source.indexOf('export async function savePosOrder('), source.indexOf('export async function updatePosOrder('));
  const edit = source.slice(source.indexOf('export async function updatePosOrder('));
  assert.match(save, /rpc\('save_pos_order_atomic'/);
  assert.match(edit, /rpc\('save_pos_order_atomic'/);
  assert.doesNotMatch(edit, /\.from\('order_items'\)/);
  assert.doesNotMatch(edit, /\.from\('order_item_addons'\)/);
});

test('coupon redemption uses one atomic RPC', () => {
  const coupons = readFileSync(resolve(process.cwd(), 'lib/coupons.ts'), 'utf8');
  const redemption = coupons.slice(coupons.indexOf('export async function recordCouponRedemption'), coupons.indexOf('/**\n * Get coupons list'));
  assert.match(redemption, /supabase\.rpc\('record_pos_coupon_redemption_atomic'/);
  assert.doesNotMatch(redemption, /\.from\('coupon_redemptions'\)|\.from\('coupons'\)/);
});
