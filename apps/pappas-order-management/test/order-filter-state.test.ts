import assert from 'node:assert/strict';
import test from 'node:test';
import { countActiveOrderFilters } from '../components/orders/filter-state';

test('quick All Orders clears the active count and empty filters do not count', () => {
  assert.equal(countActiveOrderFilters({ quick: 'all', status: undefined, search: '' }), 0);
  assert.equal(countActiveOrderFilters({ quick: 'unpaid' }), 1);
  assert.equal(countActiveOrderFilters({ quick: 'all' }), 0);
});

test('counts independent payment/source dimensions without mutating the saved selection', () => {
  const selection = { status: 'ready', payment: 'pending', method: 'card', source: 'online', search: 'Smith' };
  const original = { ...selection };
  assert.equal(countActiveOrderFilters(selection), 5);
  assert.deepEqual(selection, original);
});
