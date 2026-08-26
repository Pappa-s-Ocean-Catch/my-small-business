import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { shouldUseLiveOrderCardRail, shouldUseVerticalLiveOrderCards } from '../lib/live-orders-layout';

const liveOrdersScreenSource = readFileSync(
  resolve(process.cwd(), 'app/(drawer)/(tabs)/live-orders.tsx'),
  'utf8',
);

test('keeps detailed vertical live order cards on portrait phones', () => {
  assert.equal(shouldUseVerticalLiveOrderCards(true, 375), true);
  assert.equal(shouldUseVerticalLiveOrderCards(false, 375), false);
});

test('uses the horizontal card rail only on larger screens', () => {
  assert.equal(shouldUseLiveOrderCardRail(true, 375), false);
  assert.equal(shouldUseLiveOrderCardRail(false, 768), false);
  assert.equal(shouldUseLiveOrderCardRail(true, 768), true);
  assert.equal(shouldUseVerticalLiveOrderCards(true, 768), true);
});

test('renders filtered Live Orders as one flat card queue', () => {
  assert.doesNotMatch(liveOrdersScreenSource, /type GroupKey/);
  assert.doesNotMatch(liveOrdersScreenSource, /groupedSections/);
  assert.doesNotMatch(liveOrdersScreenSource, /verticalSection/);
  assert.match(liveOrdersScreenSource, /data=\{filteredOrders\}/);
  assert.match(liveOrdersScreenSource, /keyExtractor=\{\(order\) => order\.id\}/);
});
