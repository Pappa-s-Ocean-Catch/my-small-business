import assert from 'node:assert/strict';
import test from 'node:test';
import { runPosPostSaveMutations } from '../lib/pos-post-save-operations';

test('runs independent coupon and reward writes together and reports each failure', async () => {
  let releaseCoupon!: () => void;
  let rewardStarted = false;
  const coupon = new Promise<void>((resolve) => { releaseCoupon = resolve; });
  const operation = runPosPostSaveMutations({
    coupon: async () => { await coupon; throw new Error('coupon offline'); },
    rewards: async () => { rewardStarted = true; },
  });
  await Promise.resolve();
  assert.equal(rewardStarted, true);
  releaseCoupon();
  assert.deepEqual(await operation, ['coupon offline']);
});
