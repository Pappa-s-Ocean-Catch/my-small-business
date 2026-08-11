import assert from 'node:assert/strict';
import test from 'node:test';
import { getOrderActionFeedback } from '../lib/order-status-feedback';

test('shows completion progress only for the order being updated', () => {
  assert.deepEqual(getOrderActionFeedback('order-a', 'order-a', 'Complete'), {
    isUpdating: true,
    label: 'Completing…',
  });
  assert.deepEqual(getOrderActionFeedback('order-b', 'order-a', 'Complete'), {
    isUpdating: false,
    label: 'Complete',
  });
});
