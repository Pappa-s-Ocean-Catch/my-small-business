import assert from 'node:assert/strict';
import test from 'node:test';
import { canRetryManualPrintRequest } from '../lib/manual-print-reconciliation';

test('a preparation failure with no queued request can be retried explicitly', () => {
  assert.equal(canRetryManualPrintRequest([], []), true);
});

test('unknown, missing, queued and in-flight outcomes never allow a duplicate request', () => {
  for (const status of ['queued', 'printing', 'success']) {
    assert.equal(canRetryManualPrintRequest(['request-1'], [{ id: 'request-1', status }]), false);
  }
  assert.equal(canRetryManualPrintRequest(['request-1'], []), false);
});

test('every job in the submitted request must have a confirmed failure before retry', () => {
  assert.equal(canRetryManualPrintRequest(['request-1', 'request-2'], [{ id: 'request-1', status: 'failed' }]), false);
  assert.equal(canRetryManualPrintRequest(['request-1', 'request-2'], [{ id: 'request-1', status: 'failed' }, { id: 'request-2', status: 'success' }]), false);
  assert.equal(canRetryManualPrintRequest(['request-1', 'request-2'], [{ id: 'request-1', status: 'failed' }, { id: 'request-2', status: 'failed' }]), true);
});
