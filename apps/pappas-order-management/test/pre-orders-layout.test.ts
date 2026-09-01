import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const preOrdersScreenSource = readFileSync(
  resolve(process.cwd(), 'app/(drawer)/pre-orders.tsx'),
  'utf8',
);

test('uses the Live Orders responsive card layout for preorders', () => {
  assert.match(preOrdersScreenSource, /const \{ width, height \} = useWindowDimensions\(\)/);
  assert.match(preOrdersScreenSource, /shouldUseVerticalLiveOrderCards\(/);
  assert.match(preOrdersScreenSource, /shouldUseLiveOrderCardRail\(/);
  assert.match(preOrdersScreenSource, /shouldUseCompactLiveOrderCards\(/);
  assert.match(preOrdersScreenSource, /horizontal=\{useVerticalCardRail\}/);
  assert.match(preOrdersScreenSource, /layout=\{isVerticalCardLayout \? 'vertical' : 'horizontal'\}/);
  assert.match(preOrdersScreenSource, /compact=\{useCompactVerticalCards\}/);
  assert.match(preOrdersScreenSource, /cardWidth=\{useVerticalCardRail \? liveOrderCardWidth : undefined\}/);
});
