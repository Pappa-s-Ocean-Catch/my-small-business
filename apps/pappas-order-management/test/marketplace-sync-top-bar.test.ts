import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('top-bar marketplace icon uses the sync indicator colour', () => {
  const source = readFileSync('app/(drawer)/(tabs)/_layout.tsx', 'utf8');

  assert.match(source, /getMarketplaceSyncIndicatorColor/);
  assert.match(source, /icon="storefront-outline"/);
  assert.match(source, /iconColor=\{marketplaceSyncColor\}/);
});
