import assert from 'node:assert/strict';
import test from 'node:test';
// Node's type-stripping test runner requires the source-file extension.
// @ts-expect-error TypeScript's app configuration intentionally disallows it.
import { isStaffOrAdmin } from './staff-api-auth.ts';

test('permits only staff and admin roles', () => {
  assert.equal(isStaffOrAdmin('staff'), true);
  assert.equal(isStaffOrAdmin('admin'), true);
  assert.equal(isStaffOrAdmin('customer'), false);
  assert.equal(isStaffOrAdmin(null), false);
});
