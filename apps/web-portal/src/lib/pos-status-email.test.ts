import assert from 'node:assert/strict';
import test from 'node:test';
// Node's type-stripping test runner requires the source-file extension.
// @ts-expect-error TypeScript's app configuration intentionally disallows it.
import { isPosStatusEmailStatus, isPublicStatusEmailStatus } from './pos-status-email.ts';

test('permits only POS-managed order status emails', () => {
  assert.equal(isPosStatusEmailStatus('ready'), true);
  assert.equal(isPosStatusEmailStatus('completed'), true);
  assert.equal(isPosStatusEmailStatus('placed'), false);
  assert.equal(isPosStatusEmailStatus('cancelled'), false);
});

test('permits only placed emails on the public checkout route', () => {
  assert.equal(isPublicStatusEmailStatus('placed'), true);
  assert.equal(isPublicStatusEmailStatus('ready'), false);
  assert.equal(isPublicStatusEmailStatus('completed'), false);
});
