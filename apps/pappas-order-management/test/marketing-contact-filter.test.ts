import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesContactFilter } from '../lib/marketing-contact-filter';

const emailOnly = { email: 'email@example.com', phone: '' };
const phoneOnly = { email: '', phone: '0400000000' };
const both = { email: 'both@example.com', phone: '0400000001' };
const neither = { email: '', phone: '' };

test('filters contacts using the selected email and phone requirements', () => {
  assert.equal(matchesContactFilter(emailOnly, { email: false, phone: false }), true);
  assert.equal(matchesContactFilter(neither, { email: false, phone: false }), true);
  assert.equal(matchesContactFilter(emailOnly, { email: true, phone: false }), true);
  assert.equal(matchesContactFilter(phoneOnly, { email: true, phone: false }), false);
  assert.equal(matchesContactFilter(phoneOnly, { email: false, phone: true }), true);
  assert.equal(matchesContactFilter(emailOnly, { email: false, phone: true }), false);
  assert.equal(matchesContactFilter(both, { email: true, phone: true }), true);
  assert.equal(matchesContactFilter(emailOnly, { email: true, phone: true }), false);
  assert.equal(matchesContactFilter(phoneOnly, { email: true, phone: true }), false);
});
