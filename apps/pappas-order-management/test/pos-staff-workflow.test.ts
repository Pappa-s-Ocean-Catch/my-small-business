import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildAddonsFromQuantities } from '../lib/addon-selection';
import type { AddonGroup } from '../app/pos.types';

test('staff POS accepts a plain item without changing online required metadata', () => {
  const groups = [{ id: 'salt', name: 'Salt', is_required: true, multiple_choice: false, items: [{ id: 'chicken', name: 'Chicken salt', extra_price: 0 }] }] as AddonGroup[];
  assert.deepEqual(buildAddonsFromQuantities(groups, {}), []);
  assert.equal(groups[0].is_required, true);
  assert.equal(buildAddonsFromQuantities(groups, { chicken: 1 })[0].addon_item_name, 'Chicken salt');
  const pos = readFileSync('app/pos.tsx', 'utf8');
  assert.equal(/missingRequiredAddonGroup|validateCartModifiers|Required item options/.test(pos), false, 'POS checkout must not apply the online required-option gate');
  assert.doesNotMatch(readFileSync('components/pos/PosMenuPane.tsx', 'utf8'), /group\.is_required\s*\?\s*'Required'/, 'Staff options must not be labelled required');
});
