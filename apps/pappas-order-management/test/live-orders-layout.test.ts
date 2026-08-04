import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldUseLiveOrderCardRail, shouldUseVerticalLiveOrderCards } from '../lib/live-orders-layout';

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
