import test from 'node:test';
import assert from 'node:assert/strict';
import { customerFromSummary } from '../utils/customer-profile';

test('uses profileId rather than a summary row id when resolving a customer', () => {
  assert.deepEqual(customerFromSummary({
    name: 'Existing Customer',
    email: '',
    phone: '+61400111222',
    profileId: 'profile-123',
  }), {
    id: 'profile-123',
    name: 'Existing Customer',
    email: '',
    phone: '+61400111222',
  });
});

test('does not treat order history without a profile as a customer record', () => {
  assert.equal(customerFromSummary({ name: 'Old order', phone: '0400111222', profileId: null }), null);
});
