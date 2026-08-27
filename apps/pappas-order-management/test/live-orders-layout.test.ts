import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  getLiveOrderCardRailColumnCount,
  getLiveOrderCardRailWidth,
  shouldUseCompactLiveOrderCards,
  shouldUseLiveOrderCardRail,
  shouldUseVerticalLiveOrderCards,
} from '../lib/live-orders-layout';

const liveOrdersScreenSource = readFileSync(
  resolve(process.cwd(), 'app/(drawer)/(tabs)/live-orders.tsx'),
  'utf8',
);
const liveOrderCardSource = readFileSync(
  resolve(process.cwd(), 'components/LiveOrderListItem.tsx'),
  'utf8',
);

test('keeps detailed vertical live order cards on portrait phones', () => {
  assert.equal(shouldUseVerticalLiveOrderCards(true, 375), true);
  assert.equal(shouldUseVerticalLiveOrderCards(false, 375), false);
});

test('uses the horizontal card rail only on larger landscape screens', () => {
  assert.equal(shouldUseLiveOrderCardRail(true, 375, 812), false);
  assert.equal(shouldUseLiveOrderCardRail(false, 1024, 600), false);
  assert.equal(shouldUseLiveOrderCardRail(true, 768, 1024), false);
  assert.equal(shouldUseLiveOrderCardRail(true, 768, 480), true);
  assert.equal(shouldUseVerticalLiveOrderCards(true, 768), true);
});

test('fits three landscape cards when the screen is wide enough and two when it is not', () => {
  assert.equal(getLiveOrderCardRailColumnCount(1024, 600), 3);
  assert.equal(getLiveOrderCardRailColumnCount(800, 600), 2);
  assert.equal(getLiveOrderCardRailColumnCount(768, 1024), 1);
  assert.equal(getLiveOrderCardRailWidth(1024, 600), 325);
  assert.equal(getLiveOrderCardRailWidth(800, 600), 382);
});

test('uses compact vertical cards on short landscape screens', () => {
  assert.equal(shouldUseCompactLiveOrderCards(true, 1024, 600), true);
  assert.equal(shouldUseCompactLiveOrderCards(true, 1024, 720), false);
  assert.equal(shouldUseCompactLiveOrderCards(true, 480, 320), false);
  assert.equal(shouldUseCompactLiveOrderCards(false, 1024, 600), false);
});

test('reads the screen height before checking for a single-column card', () => {
  assert.match(liveOrderCardSource, /const \{ width, height \} = useWindowDimensions\(\)/);
});

test('uses a fixed height only for landscape rail cards', () => {
  assert.match(liveOrderCardSource, /cardWidth != null \? styles\.verticalOrderCardRail : null/);
  assert.match(liveOrderCardSource, /cardWidth != null && compact \? styles\.verticalOrderCardRailCompact : null/);
  assert.match(liveOrderCardSource, /verticalOrderCardRail: \{[\s\S]*height: 586/);
  assert.match(liveOrderCardSource, /verticalOrderCardRailCompact: \{[\s\S]*height: 360/);
  assert.match(liveOrderCardSource, /cardWidth != null \? styles\.itemsPreviewBlockRail : null/);
  assert.match(liveOrderCardSource, /itemsPreviewBlockRail: \{[\s\S]*minHeight: 102/);
  assert.doesNotMatch(liveOrderCardSource, /verticalOrderCard: \{[^}]*height:/);
});

test('adds spacing between cards in the vertical list only', () => {
  assert.match(liveOrderCardSource, /cardWidth == null \? styles\.verticalOrderCardList : null/);
  assert.match(liveOrderCardSource, /verticalOrderCardList: \{ marginBottom: 12 \}/);
});

test('renders filtered Live Orders as one flat card queue', () => {
  assert.doesNotMatch(liveOrdersScreenSource, /type GroupKey/);
  assert.doesNotMatch(liveOrdersScreenSource, /groupedSections/);
  assert.doesNotMatch(liveOrdersScreenSource, /verticalSection/);
  assert.match(liveOrdersScreenSource, /data=\{filteredOrders\}/);
  assert.match(liveOrdersScreenSource, /keyExtractor=\{\(order\) => order\.id\}/);
});

test('uses the landscape card rail for the flat live-order queue', () => {
  assert.match(liveOrdersScreenSource, /const useVerticalCardRail = shouldUseLiveOrderCardRail\(/);
  assert.match(liveOrdersScreenSource, /const liveOrderCardWidth = getLiveOrderCardRailWidth\(/);
  assert.match(liveOrdersScreenSource, /const useCompactVerticalCards = shouldUseCompactLiveOrderCards\(/);
  assert.match(liveOrdersScreenSource, /horizontal=\{useVerticalCardRail\}/);
  assert.match(liveOrdersScreenSource, /cardWidth=\{liveOrderCardWidth\}/);
  assert.match(liveOrdersScreenSource, /compact=\{useCompactVerticalCards\}/);
});

test('keeps header action buttons at the journal button height', () => {
  const headerActionButtons = liveOrdersScreenSource.match(/styles\.headerActionButton/g) ?? [];
  assert.equal(headerActionButtons.length, 3);
  assert.match(liveOrdersScreenSource, /headerActionButton: \{ height: 40, minHeight: 40 \}/);
});
