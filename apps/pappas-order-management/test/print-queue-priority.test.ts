import assert from 'node:assert/strict';
import test from 'node:test';
import { selectReadyPrintJobIds } from '../lib/print-job-priority';

test('selects a queued customer receipt before an older kitchen job on the same printer', () => {
  assert.deepEqual(selectReadyPrintJobIds([
    { id: 'kitchen', priority: 'normal', status: 'queued', printerTarget: 'counter' },
    { id: 'customer', priority: 'customer-receipt', status: 'queued', printerTarget: 'counter' },
  ]), ['customer']);
});

test('does not preempt a print already active on the same printer', () => {
  assert.deepEqual(selectReadyPrintJobIds([
    { id: 'kitchen', priority: 'normal', status: 'printing', printerTarget: 'counter' },
    { id: 'customer', priority: 'customer-receipt', status: 'queued', printerTarget: 'counter' },
  ]), []);
});
