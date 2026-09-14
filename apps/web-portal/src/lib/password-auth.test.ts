import assert from 'node:assert/strict';
import test from 'node:test';
// Node's type-stripping test runner requires the source-file extension.
// @ts-expect-error TypeScript's app configuration intentionally disallows it.
import { getRecoveryTokens, hasPasswordLogin, withRedirectTo } from './password-auth.ts';

test('extracts recovery access and refresh tokens from an auth callback hash', () => {
  assert.deepEqual(
    getRecoveryTokens('#access_token=access-token&refresh_token=refresh-token&type=recovery'),
    { accessToken: 'access-token', refreshToken: 'refresh-token' },
  );
});

test('rejects an incomplete recovery token pair', () => {
  assert.equal(getRecoveryTokens('#access_token=access-token&type=recovery'), null);
});

test('treats an email magic-link user as passwordless until a password is recorded', () => {
  assert.equal(hasPasswordLogin({ app_metadata: { provider: 'email' } }), false);
  assert.equal(hasPasswordLogin({ user_metadata: { has_password: true } }), true);
});

test('replaces a Supabase action link redirect with the configured reset page', () => {
  const actionLink = withRedirectTo(
    'https://project.supabase.co/auth/v1/verify?token=secret&type=recovery&redirect_to=https%3A%2F%2Fexample.com%2F',
    'https://app.example.com/reset-password',
  );

  assert.equal(
    new URL(actionLink).searchParams.get('redirect_to'),
    'https://app.example.com/reset-password',
  );
});
