import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_MARKETPLACE_SOUND_SETTINGS, normalizeMarketplaceSoundSettings, getOrderSoundOptions } from '../lib/order-sound-settings';
const sounds = [{ id: 'so-proud-notification' }, { id: 'vopvoopvooop' }];
const settings = { ...DEFAULT_MARKETPLACE_SOUND_SETTINGS, soundEnabled: true, soundId: 'so-proud-notification' as const, soundRepeatCount: 3, marketplaceUberSoundId: 'vopvoopvooop' as const, marketplaceUberSoundRepeatCount: 2 };
const order = { order_channel: 'third_party' as const, payment_method: 'store' as const, customer_name: 'Customer', scheduled_pickup_at: null, delivery_partner_name: 'Uber Eats', payment_method_detail: 'Uber Eats' };
test('new provider alarms default independently from disabled online sounds', () => {
  assert.deepEqual(normalizeMarketplaceSoundSettings({ soundEnabled: false }, sounds), DEFAULT_MARKETPLACE_SOUND_SETTINGS);
  assert.ok(getOrderSoundOptions(order, { ...settings, soundEnabled: false }));
});
test('routes provider sounds independently, including scheduled orders and payment source fallback', () => {
  assert.deepEqual(getOrderSoundOptions(order, settings), { soundId: 'vopvoopvooop', repeatCount: 2, delayMs: 1000 });
  assert.equal(getOrderSoundOptions(order, { ...settings, marketplaceUberSoundEnabled: false }), null);
  assert.deepEqual(getOrderSoundOptions({ ...order, delivery_partner_name: null, payment_method_detail: 'DoorDash' }, { ...settings, marketplaceUberSoundEnabled: false }), { soundId: 'so-proud-notification', repeatCount: 3, delayMs: 1000 });
  assert.equal(getOrderSoundOptions({ ...order, delivery_partner_name: 'DoorDash', scheduled_pickup_at: '2026-10-29T00:00:00Z' }, { ...settings, marketplaceDoorDashSoundEnabled: false }), null);
  assert.equal(getOrderSoundOptions({ ...order, delivery_partner_name: 'Other', payment_method_detail: 'Other' }, settings), null);
});
test('preserves existing online and scheduled phone behaviour, excluding ordinary POS orders', () => {
  assert.deepEqual(getOrderSoundOptions({ ...order, order_channel: 'online' }, settings), { soundId: 'so-proud-notification', repeatCount: 3, delayMs: 1000 });
  assert.equal(getOrderSoundOptions({ ...order, order_channel: 'online' }, { ...settings, soundEnabled: false }), null);
  assert.ok(getOrderSoundOptions({ ...order, order_channel: 'phone_pickup', scheduled_pickup_at: '2026-10-29T00:00:00Z' }, settings));
  assert.equal(getOrderSoundOptions({ ...order, order_channel: 'instore' }, settings), null);
});
test('normalizes invalid saved provider values without leaking between providers', () => {
  const value = normalizeMarketplaceSoundSettings({ marketplaceUberSoundEnabled: false, marketplaceUberSoundId: 'vopvoopvooop', marketplaceUberSoundRepeatCount: 99, marketplaceDoorDashSoundId: 'missing', marketplaceDoorDashSoundRepeatCount: NaN }, sounds);
  assert.equal(value.marketplaceUberSoundEnabled, false);
  assert.equal(value.marketplaceUberSoundId, 'vopvoopvooop');
  assert.equal(value.marketplaceUberSoundRepeatCount, 10);
  assert.equal(value.marketplaceDoorDashSoundEnabled, true);
  assert.equal(value.marketplaceDoorDashSoundId, 'so-proud-notification');
  assert.equal(value.marketplaceDoorDashSoundRepeatCount, 3);
});
