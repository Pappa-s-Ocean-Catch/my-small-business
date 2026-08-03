import assert from 'node:assert/strict';
import test from 'node:test';

import { usesLandscapeTabletOrderDetailLayout } from '../utils/order-detail-layout';

test('uses the order detail split layout only on a landscape tablet', () => {
  assert.equal(usesLandscapeTabletOrderDetailLayout(1180, 820), true);
  assert.equal(usesLandscapeTabletOrderDetailLayout(820, 1180), false);
  assert.equal(usesLandscapeTabletOrderDetailLayout(800, 600), false);
});
