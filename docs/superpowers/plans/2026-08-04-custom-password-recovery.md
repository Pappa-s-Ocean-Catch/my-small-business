# Custom Password Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send password-recovery emails from the configured Pappas sender, accept the recovery session from a valid link, and allow magic-link-only users to create a first password.

**Architecture:** The server action will ask Supabase Admin to generate a recovery action link and deliver that link with Resend. Client-side recovery parsing and profile password-status decisions will be small pure helpers, allowing tests to cover authentication states without real Supabase or email traffic.

**Tech Stack:** Next.js 16, TypeScript, Supabase JS v2, Resend, React Email, Node built-in test runner via `tsx`.

## Global Constraints

- Never send or log recovery credentials outside the email being delivered.
- Keep Supabase recovery-token issuance authoritative; the application only delivers its action URL.
- Reuse `EMAIL_FROM`, `RESEND_API_KEY`, and current brand settings.
- Preserve password-policy enforcement in Supabase and the existing six-character client validation.

---

### Task 1: Branded recovery email generation

**Files:**
- Create: `apps/web/src/app/actions/password-reset.test.ts`
- Modify: `apps/web/src/app/actions/password-reset.ts`
- Modify: `apps/web/src/emails/PasswordReset.tsx`

**Interfaces:**
- Consumes: `supabase.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } })`
- Produces: `sendPasswordResetEmail(email): Promise<{ success: boolean; error?: string }>`

- [ ] **Step 1: Write the failing test**

```ts
test('sends the Supabase-generated recovery action link using the branded sender', async () => {
  const result = await sendPasswordResetEmail('person@example.com');
  assert.equal(result.success, true);
  assert.equal(generatedLink.type, 'recovery');
  assert.equal(sentEmail.to[0], 'person@example.com');
  assert.equal(sentEmail.from, 'Pappas <team@example.com>');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec tsx --test src/app/actions/password-reset.test.ts`

Expected: FAIL because the action still calls `resetPasswordForEmail` rather than generating and delivering a custom action URL.

- [ ] **Step 3: Write minimal implementation**

```ts
const { data, error } = await supabase.auth.admin.generateLink({
  type: 'recovery',
  email: normalizedEmail,
  options: { redirectTo: `${getSiteUrl()}/reset-password` },
});
await resend.emails.send({
  from: process.env.EMAIL_FROM!,
  to: [normalizedEmail],
  subject: `Reset your ${businessName} password`,
  react: PasswordReset({ resetUrl: data.properties.action_link, userEmail: normalizedEmail, businessName }),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec tsx --test src/app/actions/password-reset.test.ts`

Expected: PASS.

### Task 2: Recovery session and password-state helpers

**Files:**
- Create: `apps/web/src/lib/password-auth.ts`
- Create: `apps/web/src/lib/password-auth.test.ts`
- Modify: `apps/web/src/app/(auth)/reset-password/page.tsx`
- Modify: `apps/web/src/app/profile/page.tsx`

**Interfaces:**
- Produces: `getRecoveryTokens(hash: string): { accessToken: string; refreshToken: string } | null`
- Produces: `hasPasswordLogin(user: { app_metadata?: unknown; user_metadata?: unknown }): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
test('extracts both recovery tokens from a callback hash', () => {
  assert.deepEqual(getRecoveryTokens('#access_token=access&refresh_token=refresh&type=recovery'), {
    accessToken: 'access', refreshToken: 'refresh',
  });
});

test('treats an email magic-link user as passwordless until marked', () => {
  assert.equal(hasPasswordLogin({ app_metadata: { provider: 'email' } }), false);
  assert.equal(hasPasswordLogin({ user_metadata: { has_password: true } }), true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web exec tsx --test src/lib/password-auth.test.ts`

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function getRecoveryTokens(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export function hasPasswordLogin(user: { user_metadata?: unknown }) {
  return (user.user_metadata as { has_password?: boolean } | undefined)?.has_password === true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web exec tsx --test src/lib/password-auth.test.ts`

Expected: PASS.

- [ ] **Step 5: Wire runtime flows**

Set the recovery session before checking `getUser()` on the reset page. Persist `has_password: true` through `updateUser` at the same time as a successful first password creation, then derive the profile UI from `hasPasswordLogin`.

### Task 3: Full verification

**Files:**
- Verify: `apps/web/src/app/actions/password-reset.test.ts`
- Verify: `apps/web/src/lib/password-auth.test.ts`
- Verify: `apps/web/src/app/(auth)/reset-password/page.tsx`
- Verify: `apps/web/src/app/profile/page.tsx`

- [ ] **Step 1: Run focused auth regression tests**

Run: `pnpm --filter web exec tsx --test src/app/actions/password-reset.test.ts src/lib/password-auth.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 2: Run lint**

Run: `pnpm --filter web lint`

Expected: exit code 0.

- [ ] **Step 3: Run production build**

Run: `pnpm --filter web build`

Expected: exit code 0.
