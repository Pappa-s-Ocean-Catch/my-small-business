import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeEditableAddons, mergeEditableRemovals, missingRequiredAddonGroup, planProductTap, updateAddedLine } from '../components/pos/pos-draft';
import type { AddonGroup, PosCartItem } from '../app/pos.types';

const line = (id: string, note = '') => ({ id, order_id: 'order', product_id: 'fish', product_name: 'Fish', quantity: 1, base_price: 8, subtotal: 8, addons: [], comment: note, pos_updated_at: 1, pos_group_name: 'Fish' } as unknown as PosCartItem);

test('a product tap immediately inserts a stable line before modifiers open', () => {
  const result = planProductTap([], line('new'), null);
  assert.equal(result.items[0].id, 'new');
  assert.equal(result.items[0].subtotal, 8);
  assert.equal(result.inserted, true);
});

test('repeated plain taps merge, while customized copies and free items remain separate', () => {
  const original = [line('plain')];
  const merged = planProductTap(original, line('new'), null);
  assert.equal(merged.items.length, 1);
  assert.equal(merged.items[0].id, 'plain');
  assert.equal(merged.items[0].quantity, 2);
  assert.equal(merged.items[0].subtotal, 16);
  assert.equal(merged.inserted, false);
  assert.equal(original[0].quantity, 1);
  assert.equal(planProductTap([line('plain'), line('custom', 'No salt')], line('new'), null).items.length, 3);
  assert.equal(planProductTap(original, line('paid'), 'plain').items.length, 2);
});

test('modifier, quantity and note updates change only the already-added line', () => {
  const original = [line('a'), line('b')];
  const changed = updateAddedLine(original, 'a', { quantity: 2, addons: [{ addon_item_price: 1 } as any, { addon_item_price: 1 } as any], comment: 'Separate', removed_ingredients: ['Onion'] }, 2);
  assert.equal(changed.length, 2);
  assert.equal(changed[0].id, 'a');
  assert.equal(changed[0].subtotal, 20);
  assert.equal(changed[0].comment, 'Separate');
  assert.equal(changed[0].pos_group_name, 'Fish');
  assert.equal(changed[1], original[1]);
  assert.equal(updateAddedLine([], 'removed', { quantity: 2 }, 3).length, 0);
});

test('optional groups allow confirmation while required groups identify the missing choice', () => {
  const groups = [{ id: 'salt', name: 'Salt', is_required: true, items: [{ id: 'none' }] }, { id: 'sauce', name: 'Sauce', is_required: false, items: [{ id: 'tomato' }] }] as AddonGroup[];
  assert.equal(missingRequiredAddonGroup(groups, {})?.name, 'Salt');
  assert.equal(missingRequiredAddonGroup(groups, { none: 1 }), undefined);
  assert.equal(missingRequiredAddonGroup(groups, { none: 0 })?.name, 'Salt');
});



test('historical add-ons retain their price when quantity or notes change', () => {
  const historical = { ...line('old'), addons: [{ addon_item_id: 'inactive', addon_item_price: 2 } as any], removed_ingredients: ['Old ingredient'] };
  const changed = updateAddedLine([historical], 'old', { quantity: 3, comment: 'Separate' }, 3)[0];
  assert.equal(changed.subtotal, 30);
  assert.deepEqual(changed.addons, historical.addons);
  assert.deepEqual(changed.removed_ingredients, ['Old ingredient']);
});

test('editing current choices preserves unmapped history and other modifier groups', () => {
  const old = [{ addon_item_id: 'inactive', addon_item_price: 2 }, { addon_item_id: 'other-group', addon_item_price: 3 }, { addon_item_id: 'salt', addon_item_price: 0 }] as PosCartItem['addons'];
  const replacement = [{ addon_item_id: 'chicken', addon_item_price: 1 }] as PosCartItem['addons'];
  const merged = mergeEditableAddons(old, replacement, ['salt', 'chicken']);
  assert.deepEqual(merged.map(a => a.addon_item_id), ['inactive', 'other-group', 'chicken']);
  assert.equal(merged[0], old[0]);
  assert.deepEqual(mergeEditableRemovals(['Old ingredient', 'Onion'], ['Tomato'], ['Onion', 'Tomato']), ['Old ingredient', 'Tomato']);
});
