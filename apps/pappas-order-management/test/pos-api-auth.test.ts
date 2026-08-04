import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStaffAuthorizationHeader } from '../lib/pos-api-auth';

test('builds a bearer authorization header for protected POS APIs', () => {
  assert.deepEqual(buildStaffAuthorizationHeader('token-123'), {
    Authorization: 'Bearer token-123',
  });
});
