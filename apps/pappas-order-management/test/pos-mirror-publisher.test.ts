import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import type { EmptyMirrorOrder, MirrorOrderSnapshotV1 } from '@my-small-business/pos-mirror';
import { createPosMirrorPublisher } from '../lib/pos-mirror-publisher';

const snapshotA: MirrorOrderSnapshotV1 = {
  version: 1,
  updatedAt: '2026-09-17T00:00:00.000Z',
  itemCount: 1,
  items: [{
    id: 'item-a',
    name: 'Souvlaki',
    quantity: 1,
    unitPrice: 12,
    lineTotal: 12,
  }],
  subtotal: 12,
  discount: 0,
  total: 12,
};

const snapshotB: MirrorOrderSnapshotV1 = {
  version: 1,
  updatedAt: '2026-09-17T00:00:01.000Z',
  itemCount: 2,
  items: [{
    id: 'item-b',
    name: 'Chips',
    quantity: 2,
    unitPrice: 4.5,
    lineTotal: 9,
  }],
  subtotal: 9,
  discount: 1,
  total: 8,
};

type MirrorRow = {
  register_id: string;
  current_order: MirrorOrderSnapshotV1 | EmptyMirrorOrder;
};

test('debounces cart changes and publishes only the newest snapshot', async () => {
  const rows: MirrorRow[] = [];
  const publisher = createPosMirrorPublisher({
    loadRegisterId: async () => 'register-1',
    upsert: async (row) => { rows.push(row); },
    debounceMs: 10,
  });

  publisher.schedule(snapshotA);
  publisher.schedule(snapshotB);
  await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 25));
  await publisher.flush();

  assert.deepEqual(rows, [{ register_id: 'register-1', current_order: snapshotB }]);
});

test('publishes an empty object when the current order is cleared', async () => {
  const rows: MirrorRow[] = [];
  const publisher = createPosMirrorPublisher({
    loadRegisterId: async () => 'register-1',
    upsert: async (row) => { rows.push(row); },
    debounceMs: 10,
  });

  publisher.schedule(snapshotA);
  await publisher.flush();
  publisher.schedule({});
  await publisher.flush();

  assert.deepEqual(rows, [
    { register_id: 'register-1', current_order: snapshotA },
    { register_id: 'register-1', current_order: {} },
  ]);
});

test('swallows an upsert failure and permits a later publish to recover', async () => {
  const attempts: MirrorRow[] = [];
  const publisher = createPosMirrorPublisher({
    loadRegisterId: async () => 'register-1',
    upsert: async (row) => {
      attempts.push(row);
      if (attempts.length === 1) throw new Error('offline');
    },
    debounceMs: 10,
    logError: () => undefined,
  });

  publisher.schedule(snapshotA);
  await assert.doesNotReject(publisher.flush());
  publisher.schedule(snapshotB);
  await assert.doesNotReject(publisher.flush());

  assert.deepEqual(attempts, [
    { register_id: 'register-1', current_order: snapshotA },
    { register_id: 'register-1', current_order: snapshotB },
  ]);
});

test('caches the register ID across mirror writes', async () => {
  let registerLoads = 0;
  const publisher = createPosMirrorPublisher({
    loadRegisterId: async () => {
      registerLoads += 1;
      return 'register-1';
    },
    upsert: async () => undefined,
    debounceMs: 10,
  });

  publisher.schedule(snapshotA);
  await publisher.flush();
  publisher.schedule(snapshotB);
  await publisher.flush();

  assert.equal(registerLoads, 1);
});

test('logs only a short register suffix when a mirror write fails', async () => {
  const messages: string[] = [];
  const publisher = createPosMirrorPublisher({
    loadRegisterId: async () => 'register-secret-12345678',
    upsert: async () => { throw new Error('offline'); },
    debounceMs: 10,
    logError: (message) => { messages.push(message); },
  });

  publisher.schedule(snapshotA);
  await assert.doesNotReject(publisher.flush());

  assert.equal(messages.length, 1);
  assert.match(messages[0], /5678/);
  assert.doesNotMatch(messages[0], /register-secret-12345678/);
});

const posSourcePath = process.cwd().endsWith('apps/pappas-order-management')
  ? resolve(process.cwd(), 'app/pos.tsx')
  : resolve(process.cwd(), 'apps/pappas-order-management/app/pos.tsx');
const posSource = readFileSync(posSourcePath, 'utf8');

const flow = (start: string, end: string): string => {
  const startIndex = posSource.indexOf(start);
  const endIndex = posSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing flow start: ${start}`);
  assert.notEqual(endIndex, -1, `missing flow end: ${end}`);
  return posSource.slice(startIndex, endIndex);
};

test('clears the mirror at all six completed checkout boundaries', () => {
  const pickup = flow('const handleCheckout', 'const handleSmartpayInstoreCheckout');
  const smartpay = flow('const handleSmartpayInstoreCheckout', 'const confirmDismissSmartpayLock');
  const instore = flow('const handleInstoreCheckout', 'const handleThirdPartyCheckout');
  const thirdParty = flow('const handleThirdPartyCheckout', 'const handleDeliveryCheckout');
  const delivery = flow('const handleDeliveryCheckout', 'const openInstorePaymentPrompt');

  assert.match(
    pickup,
    /await applyRewardPointsForSavedOrder[\s\S]*if \(isEditingExistingOrder\)[\s\S]*await clearMirrorAfterCheckout\(\);\s*router\.back\(\);/,
  );
  assert.match(
    smartpay,
    /await printInstoreCustomerReceipt\(completedOrder\);[\s\S]*await clearMirrorAfterCheckout\(\);\s*router\.back\(\);/,
  );
  assert.match(
    instore,
    /if \(pendingInstoreSmartpayOrder && pendingPaymentPlan\)[\s\S]*await printInstoreCustomerReceipt\(completedOrder\);[\s\S]*await clearMirrorAfterCheckout\(\);\s*router\.back\(\);/,
  );
  assert.match(
    instore,
    /Instore checkout post-save work failed[\s\S]*invalidateTopSellers\(\);\s*await clearMirrorAfterCheckout\(\);\s*resetPosForNextOrder\(\);/,
  );
  assert.match(
    thirdParty,
    /if \(result\.error\)[\s\S]*return;[\s\S]*await clearMirrorAfterCheckout\(\);\s*router\.back\(\);/,
  );
  assert.match(
    delivery,
    /const checkoutSession = await createStripeCheckoutSession[\s\S]*await clearMirrorAfterCheckout\(\);\s*resetPosForNextOrder\(\);/,
  );

  assert.equal(posSource.match(/await clearMirrorAfterCheckout\(\);/g)?.length, 6);
});

test('does not clear the mirror when only a temporary Smartpay order was created', () => {
  const smartpay = flow('const handleSmartpayInstoreCheckout', 'const confirmDismissSmartpayLock');
  const pendingCreation = smartpay.slice(
    smartpay.indexOf('if (!pendingOrder) {'),
    smartpay.indexOf('const paymentPlan = getPendingInstorePaymentPlan'),
  );

  assert.match(pendingCreation, /createOrReusePendingInstoreOrder/);
  assert.doesNotMatch(pendingCreation, /clearMirrorAfterCheckout/);
});
