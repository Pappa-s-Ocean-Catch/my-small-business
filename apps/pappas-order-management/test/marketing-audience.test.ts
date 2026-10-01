import assert from 'node:assert/strict';
import test from 'node:test';
import { getPendingRecipients, loadMarketingAudience, matchesMarketingHistory, compareNeverContacted, canSelectRecipient, removeRecipients } from '../lib/marketing-audience';

test('never contacted requires no send on either channel', () => {
  assert.equal(matchesMarketingHistory({}, 'never-contacted'), true);
  assert.equal(matchesMarketingHistory({ lastMarketingSmsSentAt: '2026-01-01' }, 'never-contacted'), false);
  assert.equal(matchesMarketingHistory({ lastMarketingSmsSentAt: '2026-01-01' }, 'never-email'), true);
  assert.equal(matchesMarketingHistory({ lastMarketingEmailSentAt: '2026-01-01' }, 'never-sms'), true);
});
test('never-contacted customers come before inactive previously contacted customers', () => {
  assert.ok(compareNeverContacted({ lastOrderDate: '2026-09-01' }, { lastOrderDate: '2025-01-01', lastMarketingEmailSentAt: '2025-01-01' }) < 0);
});
test('selection excludes opted-out, unidentified and unreachable customers', () => {
  assert.equal(canSelectRecipient({ profileId: 'a', email: 'a@b.com' }), true);
  assert.equal(canSelectRecipient({ profileId: 'a', phone: '123', optInMarketing: false }), false);
  assert.equal(canSelectRecipient({ email: 'a@b.com' }), false);
  assert.equal(canSelectRecipient({ profileId: 'a', email: '  ' }), false);
});
test('bulk removal preserves unmarked recipients and original selection', () => {
  const selection = new Map([['a', { name: 'A' }], ['b', { name: 'B' }], ['c', { name: 'C' }]]);
  assert.deepEqual([...removeRecipients(selection, new Set(['a', 'c'])).keys()], ['b']);
  assert.equal(selection.size, 3);
});

test('loads customers beyond the first 500 and stops at the final partial batch', async () => {
  const customers = Array.from({ length: 1201 }, (_, id) => ({ id }));
  const result = await loadMarketingAudience(async (offset, limit) => ({ data: customers.slice(offset, offset + limit), error: null }));
  assert.equal(result.data?.length, 1201);
  assert.equal(result.data?.[1200].id, 1200);
});
test('audience loading reports a later page failure instead of returning a partial audience', async () => {
  const result = await loadMarketingAudience(async (offset) => offset === 0 ? { data: Array.from({ length: 500 }, () => ({})), error: null } : { data: null, error: 'offline' });
  assert.equal(result.error, 'offline');
  assert.equal(result.data, null);
});

test('email success leaves SMS recipients available and retries only failed emails', () => {
  const customers = [
    { profileId: 'sent', email: 'sent@example.com', phone: '0400000000' },
    { profileId: 'failed', email: 'failed@example.com', phone: '0411111111' },
    { profileId: 'phone-only', phone: '0422222222' },
    { profileId: 'opted-out', email: 'no@example.com', phone: '0433333333', optInMarketing: false },
  ];
  const sentEmail = new Set(['sent']);
  assert.deepEqual(getPendingRecipients(customers, 'email', sentEmail).map((customer) => customer.profileId), ['failed']);
  assert.deepEqual(getPendingRecipients(customers, 'sms', new Set()).map((customer) => customer.profileId), ['sent', 'failed', 'phone-only']);
  assert.equal(customers.length, 4);
});
