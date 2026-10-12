import assert from 'node:assert/strict';
import test from 'node:test';
import { getPrintDelayMs, waitForPrintClaimDelay } from '../lib/marketplace-print-scheduling';

test('allows zero and one-second auto-print delays without a minimum override', () => {
  assert.equal(getPrintDelayMs(0), 0);
  assert.equal(getPrintDelayMs(1), 1000);
  assert.equal(getPrintDelayMs(undefined), 3000);
});

test('backup waits the full claim delay while primary can proceed immediately', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ready: string[] = [];
  const backup = waitForPrintClaimDelay(1).then(() => { ready.push('backup'); });
  await waitForPrintClaimDelay(0);
  ready.push('primary');
  assert.deepEqual(ready, ['primary']);
  t.mock.timers.tick(999);
  await Promise.resolve();
  assert.deepEqual(ready, ['primary']);
  t.mock.timers.tick(1);
  await backup;
  assert.deepEqual(ready, ['primary', 'backup']);
});

test('unset claim delay keeps existing devices immediate', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  await waitForPrintClaimDelay(undefined);
});
