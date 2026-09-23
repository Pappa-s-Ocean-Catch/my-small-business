import assert from 'node:assert/strict';
import test from 'node:test';
import { addonQuantitiesFromAddons, buildAddonsFromQuantities, changeAddonQuantity, getAddonQuantity } from '../lib/addon-selection';
import type { AddonGroup } from '../app/pos.types';

const extras: AddonGroup = {
  id: 'extras',
  name: 'Extras',
  is_required: false,
  multiple_choice: true,
  display_order: 1,
  items: [
    { id: 'cheese', addon_group_id: 'extras', name: 'Cheese', extra_price: 1.5, section: null, sort_order: 1, is_active: true },
    { id: 'bacon', addon_group_id: 'extras', name: 'Bacon', extra_price: 2, section: null, sort_order: 2, is_active: true },
  ],
};

test('adds and removes units for a multi-choice add-on without affecting other selections', () => {
  const twiceCheese = changeAddonQuantity({}, extras, extras.items[0], 2);
  const withBacon = changeAddonQuantity(twiceCheese, extras, extras.items[1], 1);

  assert.equal(getAddonQuantity(withBacon, 'cheese'), 2);
  assert.equal(getAddonQuantity(withBacon, 'bacon'), 1);

  const addons = buildAddonsFromQuantities([extras], withBacon, () => 'now');
  assert.equal(addons.length, 3);
  assert.equal(addons.filter((addon) => addon.addon_item_id === 'cheese').length, 2);
  assert.equal(addons.reduce((total, addon) => total + addon.addon_item_price, 0), 5);

  const onceCheese = changeAddonQuantity(withBacon, extras, extras.items[0], -1);
  assert.equal(getAddonQuantity(onceCheese, 'cheese'), 1);
});

test('keeps one-choice groups mutually exclusive and at quantity one', () => {
  const choice: AddonGroup = { ...extras, id: 'cooking', multiple_choice: false };
  const withFried = changeAddonQuantity({}, choice, choice.items[0], 1);
  const withGrilled = changeAddonQuantity(withFried, choice, choice.items[1], 1);

  assert.equal(getAddonQuantity(withGrilled, 'cheese'), 0);
  assert.equal(getAddonQuantity(withGrilled, 'bacon'), 1);
  assert.equal(getAddonQuantity(changeAddonQuantity(withGrilled, choice, choice.items[1], 1), 'bacon'), 1);
});

test('restores quantities when editing an item with repeated add-ons', () => {
  const addons = buildAddonsFromQuantities([extras], { cheese: 2, bacon: 1 }, () => 'now');

  assert.deepEqual(addonQuantitiesFromAddons(addons), { cheese: 2, bacon: 1 });
});
