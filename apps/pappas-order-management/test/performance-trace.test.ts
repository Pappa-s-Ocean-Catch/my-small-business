import assert from 'node:assert/strict';
import test from 'node:test';

import { getTimerDelayMs, isSlowOperation } from '../lib/performance-trace';

test('reports only the timer delay beyond its expected interval', () => {
  assert.equal(getTimerDelayMs(10_000, 10_450), 450);
  assert.equal(getTimerDelayMs(10_000, 9_900), 0);
});

test('marks operations at the performance threshold as slow', () => {
  assert.equal(isSlowOperation(499, 500), false);
  assert.equal(isSlowOperation(500, 500), true);
});
