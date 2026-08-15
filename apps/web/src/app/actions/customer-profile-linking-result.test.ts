import assert from 'node:assert/strict';
import test from 'node:test';
// Node's type-stripping test runner requires the source-file extension.
// @ts-expect-error TypeScript's app configuration intentionally disallows it.
import { toCustomerProfileMergeResult } from './customer-profile-linking-result.ts';

test('returns the merged legacy profile id from a successful RPC result', () => {
  assert.deepEqual(
    toCustomerProfileMergeResult('00000000-0000-0000-0000-000000000102', null),
    {
      success: true,
      mergedProfileId: '00000000-0000-0000-0000-000000000102',
    },
  );
});

test('treats a successful no-match RPC result as an unmerged profile', () => {
  assert.deepEqual(toCustomerProfileMergeResult(null, null), {
    success: true,
    mergedProfileId: null,
  });
});

test('returns the database conflict message from a failed RPC result', () => {
  assert.deepEqual(
    toCustomerProfileMergeResult(null, { message: 'Email belongs to a staff account.' }),
    { success: false, error: 'Email belongs to a staff account.' },
  );
});
