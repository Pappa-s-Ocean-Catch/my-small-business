# Atomic Customer Profile Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge one legacy customer profile into a phone-OTP profile atomically, including its email, orders, and reward data.

**Architecture:** A PostgreSQL RPC owns candidate selection, conflict detection, foreign-key reassignment, reward-balance merge, legacy-profile deletion, and final destination-profile update in one transaction. The existing server action normalizes its inputs then calls that RPC; it no longer performs individual data mutations.

**Tech Stack:** Supabase Postgres migrations and SQL tests, Supabase JS service-role client, TypeScript, Node test runner.

## Global Constraints

- Preserve `public.profiles.email` as a unique column.
- Merge only `customer` profiles; never merge a staff or admin profile.
- Treat a match by email and a different match by phone as an explicit conflict.
- Make no partial changes when the merge fails.
- Retain the existing `mergeExistingCustomerProfileIntoAuthUser` public TypeScript signature and callers.

---

### Task 1: Prove the database merge contract

**Files:**
- Create: `supabase/tests/customer_profile_linking.sql`
- Modify: none

**Interfaces:**
- Consumes: `public.merge_customer_profile_into_auth_user(p_user_id uuid, p_email text, p_phone text, p_full_name text)`.
- Produces: executable SQL regression coverage for the atomic merge contract.

- [ ] **Step 1: Write the failing SQL regression test**

Create a transaction-scoped fixture with a destination customer profile that has a phone but no email and a legacy customer profile owning `merge@example.invalid`. Insert an order, one reward transaction, and a balance for the legacy profile. Call:

```sql
SELECT public.merge_customer_profile_into_auth_user(
  destination_id,
  'merge@example.invalid',
  '+61400000001',
  'Merged Customer'
);
```

Assert that the destination owns the email and updated name, the legacy profile is absent, the order and reward transaction reference the destination, and the destination balance contains the total of both profiles. In separate `BEGIN ... EXCEPTION` blocks, assert SQLSTATE `P0001` for an email held by an admin and for distinct customer candidates selected by email and phone; after each exception, assert both profiles remain present.

- [ ] **Step 2: Run the SQL test and verify it fails because the RPC is missing**

Run: `supabase db reset && supabase test db --file supabase/tests/customer_profile_linking.sql`

Expected: FAIL with `function public.merge_customer_profile_into_auth_user(...) does not exist`.

- [ ] **Step 3: Commit the failing test**

```bash
git add supabase/tests/customer_profile_linking.sql
git commit -m "test: cover atomic customer profile linking"
```

### Task 2: Implement the transactional profile merge RPC

**Files:**
- Create: `supabase/migrations/20260815220000_atomic_customer_profile_linking.sql`
- Test: `supabase/tests/customer_profile_linking.sql`

**Interfaces:**
- Consumes: `p_user_id uuid`, `p_email text`, `p_phone text`, and `p_full_name text`.
- Produces: `public.merge_customer_profile_into_auth_user(...) RETURNS uuid`, returning the merged legacy ID or `NULL` when no legacy profile matched.

- [ ] **Step 1: Create the minimal RPC implementation**

Create a `SECURITY DEFINER` PL/pgSQL function with `SET search_path = public`. Lock the destination profile using `FOR UPDATE`; raise `P0001` if it does not exist. Lock matching profiles and collect only non-destination `customer` IDs. Reject more than one unique customer candidate, and reject a supplied email owned by a non-customer profile.

When a single candidate exists, execute the following order inside the function:

```sql
UPDATE public.orders
SET user_id = p_user_id
WHERE user_id = legacy_id;

UPDATE public.reward_point_transactions
SET user_id = p_user_id
WHERE user_id = legacy_id;

-- Combine both user_reward_points rows with INSERT ... ON CONFLICT,
-- then delete the legacy balance.
DELETE FROM public.profiles WHERE id = legacy_id;

UPDATE public.profiles
SET role_slug = 'customer',
    full_name = COALESCE(NULLIF(p_full_name, ''), legacy_full_name, full_name),
    email = COALESCE(NULLIF(p_email, ''), legacy_email, email),
    phone = COALESCE(NULLIF(p_phone, ''), legacy_phone, phone)
WHERE id = p_user_id;
```

Resolve the legacy email, name, and phone before deletion. `DELETE` must precede the destination email assignment so the unique index is never violated. Use `COALESCE` for every integer total and use the latest non-null `last_transaction_at`. Grant execution only to `service_role` and revoke it from `anon` and `authenticated`.

- [ ] **Step 2: Run the focused SQL test and verify it passes**

Run: `supabase db reset && supabase test db --file supabase/tests/customer_profile_linking.sql`

Expected: PASS; the email moves to the destination and each conflict block rolls back its fixture changes.

- [ ] **Step 3: Commit the migration and passing test**

```bash
git add supabase/migrations/20260815220000_atomic_customer_profile_linking.sql supabase/tests/customer_profile_linking.sql
git commit -m "fix: merge customer profiles atomically"
```

### Task 3: Replace client-side merge mutations with the RPC call

**Files:**
- Modify: `apps/web/src/app/actions/customer-profile-linking.ts:19-150`
- Test: `apps/web/src/app/actions/customer-profile-linking.test.ts`

**Interfaces:**
- Consumes: the existing `mergeExistingCustomerProfileIntoAuthUser({ userId, email, phone, fullName })` input.
- Produces: the unchanged `{ success, error?, mergedProfileId? }` result, populated from the RPC response.

- [ ] **Step 1: Write the failing action test**

Extract a small exported result mapper from `customer-profile-linking.ts`:

```ts
export function toCustomerProfileMergeResult(
  data: string | null,
  error: { message: string } | null,
) {
  if (error) return { success: false as const, error: error.message };
  return { success: true as const, mergedProfileId: data };
}
```

In `customer-profile-linking.test.ts`, assert that an RPC error returns `{ success: false, error }`, a UUID result returns it as `mergedProfileId`, and `null` returns a successful no-legacy-match result.

- [ ] **Step 2: Run the action test and verify it fails because the mapper is missing**

Run: `node --experimental-strip-types --test apps/web/src/app/actions/customer-profile-linking.test.ts`

Expected: FAIL with a missing export error for `toCustomerProfileMergeResult`.

- [ ] **Step 3: Replace the individual requests with one RPC request**

Remove candidate queries, order and transaction reassignment, point upsert/deletion, profile update, and legacy-profile deletion from `mergeExistingCustomerProfileIntoAuthUser`. After existing normalization, call:

```ts
const { data, error } = await supabase.rpc('merge_customer_profile_into_auth_user', {
  p_user_id: input.userId,
  p_email: normalizedEmail,
  p_phone: normalizedPhone,
  p_full_name: input.fullName?.trim() || null,
});

return toCustomerProfileMergeResult(data, error);
```

Implement the mapper exactly as tested. Do not change either phone-profile completion caller.

- [ ] **Step 4: Run focused checks and verify they pass**

Run: `node --experimental-strip-types --test apps/web/src/app/actions/customer-profile-linking.test.ts && pnpm --filter web exec tsc --noEmit --pretty false`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit the action change**

```bash
git add apps/web/src/app/actions/customer-profile-linking.ts apps/web/src/app/actions/customer-profile-linking.test.ts
git commit -m "fix: call atomic customer profile merge RPC"
```

### Task 4: Run complete verification

**Files:**
- Modify: none

**Interfaces:**
- Consumes: all migrations, SQL regression test, and action test from Tasks 1-3.
- Produces: evidence that the database and TypeScript layers remain valid.

- [ ] **Step 1: Reset the local database and run all relevant tests**

Run:

```bash
supabase db reset && \
supabase test db --file supabase/tests/customer_profile_linking.sql && \
node --experimental-strip-types --test apps/web/src/app/actions/customer-profile-linking.test.ts && \
pnpm --filter web exec tsc --noEmit --pretty false && \
git diff --check
```

Expected: every command exits successfully and `git diff --check` prints nothing.

- [ ] **Step 2: Commit any verification-only correction if needed**

If verification required a source correction, commit only the correction with `git commit -m "fix: complete customer profile merge validation"`. Otherwise, do not create an empty commit.
