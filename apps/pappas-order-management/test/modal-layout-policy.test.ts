import assert from 'node:assert/strict';
import test from 'node:test';
import { getModalLayout } from '../lib/modal-layout';
import { refreshPendingPayment } from '../lib/pending-payment-monitor';

test('input/confirmation modals use 75 percent tablet width and full phone width', () => {
  assert.equal(getModalLayout(1200, 900).width, 900);
  assert.equal(getModalLayout(800, 1000).width, 600);
  assert.equal(getModalLayout(390, 844).width, 390);
  assert.equal(getModalLayout(844, 390).width, 844);
  assert.equal(getModalLayout(390, 844, { top: 44, bottom: 34 }).maxHeight, 766);
});
test('payment waiting survives temporary read errors and removes only confirmed paid sessions', async () => {
  const settled: string[] = [];
  const done = (id: string) => { settled.push(id); };
  await refreshPendingPayment('order', async () => ({ data: null, error: 'offline' }), done);
  await refreshPendingPayment('order', async () => { throw new Error('timeout'); }, done);
  await refreshPendingPayment('order', async () => ({ data: { payment_status: 'pending' } }), done);
  assert.deepEqual(settled, []);
  await refreshPendingPayment('order', async () => ({ data: { payment_status: 'paid' } }), done);
  assert.deepEqual(settled, ['order']);
});
