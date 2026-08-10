import assert from 'node:assert/strict';
import test from 'node:test';

import { groupResolverAddonTargets } from '../lib/marketplace-resolver-groups';

test('groups resolver add-ons under their POS add-on groups', () => {
  assert.deepEqual(groupResolverAddonTargets([
    { id: '1', name: 'Cheese', groupId: 'extras', groupName: 'Extras', extraPrice: 2 },
    { id: '2', name: 'Large', groupId: 'size', groupName: 'Size', extraPrice: 0 },
    { id: '3', name: 'Bacon', groupId: 'extras', groupName: 'Extras', extraPrice: 3 },
  ]), [
    { id: 'extras', name: 'Extras', items: [
      { id: '1', name: 'Cheese', extraPrice: 2 },
      { id: '3', name: 'Bacon', extraPrice: 3 },
    ] },
    { id: 'size', name: 'Size', items: [{ id: '2', name: 'Large', extraPrice: 0 }] },
  ]);
});
