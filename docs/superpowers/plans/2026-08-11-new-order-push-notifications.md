# New Order Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a best-effort Expo push notification to every registered Pappas Order Management device whenever a new order is created, without allowing notification failures to affect the order or POS flow.

**Architecture:** The mobile app registers its Expo token independently of all ordering operations. A Supabase Dashboard Database Webhook asynchronously observes committed `orders` inserts and invokes an Edge Function. The function creates a durable job in notification-only tables and sends to all stored device tokens. Database writes, webhook calls, Edge Function failures, Expo errors, and invalid tokens are isolated from `orders` so orders remain committed and usable.

**Tech Stack:** Expo SDK 54, `expo-notifications`, Expo Push Service, Firebase Cloud Messaging v1, Supabase Postgres/RLS/Database Webhooks, Supabase Edge Functions (Deno/TypeScript), Node built-in test runner.

## Global Constraints

- No code in any order creation, POS checkout, payment, marketplace import, printer, or realtime path may await or depend on notification registration or delivery.
- All notification registration, sending, receipt processing, and deep-link handling must catch failures and log a non-sensitive message; no error may be surfaced as an order failure or crash the app.
- Push payloads must exclude customer name, email, phone number, address, item list, and special instructions. Use only order ID, order number, channel, total, and event type.
- The Expo access token and the Firebase service-account JSON must never be committed or bundled in the app.
- Android requires `google-services.json`, the `expo-notifications` plugin, a new native APK, Android 13+ runtime permission, and FCM v1 credentials configured in Expo before device testing.
- Every database delivery job is unique by `order_id` but has no foreign key, trigger, constraint, or function connected to `orders`; duplicate webhook calls may not create duplicate logical jobs.
- Existing Supabase realtime/new-order sound behavior remains the in-app fallback and must not be removed or changed.

---

## File Structure

- `apps/pappas-order-management/lib/push-notifications.ts`: pure push payload and navigation helpers plus best-effort Expo registration lifecycle.
- `apps/pappas-order-management/lib/push-notifications.types.ts`: small interfaces that let Node tests exercise the lifecycle without loading native Expo modules.
- `apps/pappas-order-management/app/_layout.tsx`: starts registration only after the existing staff-access check succeeds and handles notification taps.
- `apps/pappas-order-management/app.config.js`: registers the notifications config plugin and Android notification channel/icon defaults.
- `apps/pappas-order-management/package.json` and `pnpm-lock.yaml`: add Expo-compatible notification dependency.
- `apps/pappas-order-management/tsconfig.test.json`: emits the new pure helper for the existing Node unit-test command.
- `apps/pappas-order-management/test/push-notifications.test.ts`: regression tests for safe registration and order navigation payload handling.
- `supabase/migrations/20260811110000_add_order_push_notifications.sql`: device/job tables, RLS policies, retry scheduling fields, and job constraints; it does not modify `orders`.
- `supabase/functions/send-new-order-push/index.ts`: secured webhook receiver, best-effort Expo send/receipt handling, retry state transitions, and invalid-token cleanup.
- `supabase/functions/send-new-order-push/deno.json`: Deno import map/task configuration for function tests.
- `supabase/functions/send-new-order-push/index_test.ts`: Edge Function behavior tests with injectable database and Expo transports.
- `docs/new-order-push-notifications-operations.md`: exact one-time secret, webhook, FCM, APK, and smoke-test instructions for production.

### Task 1: Add an isolated, testable app notification lifecycle

**Files:**
- Create: `apps/pappas-order-management/lib/push-notifications.types.ts`
- Create: `apps/pappas-order-management/lib/push-notifications.ts`
- Create: `apps/pappas-order-management/test/push-notifications.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**
- Consumes: a signed-in staff `userId`, Expo project ID, and injected `NotificationClient` / `PushDeviceStore` interfaces.
- Produces: `registerOrderManagementPushDevice(dependencies, userId): Promise<void>`, `getOrderIdFromNotificationData(data): string | null`, and `buildNewOrderNotification(order): ExpoPushMessage`.

- [ ] **Step 1: Write the failing tests for a safe token registration wrapper**

```ts
test('records an Expo token for a signed-in staff device', async () => {
  const upserts: Array<{ user_id: string; expo_push_token: string }> = [];
  await registerOrderManagementPushDevice({
    notificationClient: fakeNotificationClient({ permission: 'granted', token: 'ExponentPushToken[test]' }),
    pushDeviceStore: { upsert: async (device) => { upserts.push(device); } },
    projectId: 'project-id',
    platform: 'android',
  }, 'staff-id');

  assert.deepEqual(upserts, [{ user_id: 'staff-id', expo_push_token: 'ExponentPushToken[test]' }]);
});

test('swallows permission, token, and persistence failures so order management remains usable', async () => {
  await assert.doesNotReject(() => registerOrderManagementPushDevice({
    notificationClient: fakeNotificationClient({ permission: 'denied', token: null }),
    pushDeviceStore: { upsert: async () => { throw new Error('offline'); } },
    projectId: 'project-id',
    platform: 'android',
  }, 'staff-id'));
});

test('accepts only a well-formed new-order notification order ID', () => {
  assert.equal(getOrderIdFromNotificationData({ eventType: 'new_order', orderId: 'a0d7f897-b2c3-4b4e-90cf-67f259346ae2' }), 'a0d7f897-b2c3-4b4e-90cf-67f259346ae2');
  assert.equal(getOrderIdFromNotificationData({ eventType: 'new_order', orderId: '<script>' }), null);
  assert.equal(getOrderIdFromNotificationData({ eventType: 'other', orderId: 'a0d7f897-b2c3-4b4e-90cf-67f259346ae2' }), null);
});
```

- [ ] **Step 2: Run the focused test to verify it fails because the module does not exist**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="Expo token|well-formed new-order"`

Expected: FAIL during TypeScript compilation with missing `push-notifications` imports.

- [ ] **Step 3: Implement the narrow pure interfaces and best-effort lifecycle**

```ts
export async function registerOrderManagementPushDevice(
  dependencies: PushRegistrationDependencies,
  userId: string,
): Promise<void> {
  try {
    const permission = await dependencies.notificationClient.requestPermission();
    if (permission !== 'granted') return;
    const token = await dependencies.notificationClient.getExpoPushToken(dependencies.projectId);
    if (!token) return;
    await dependencies.pushDeviceStore.upsert({ user_id: userId, expo_push_token: token });
  } catch (error) {
    console.warn('[push] device registration skipped', error);
  }
}

export function getOrderIdFromNotificationData(data: unknown): string | null {
  if (!isRecord(data) || data.eventType !== 'new_order' || typeof data.orderId !== 'string') return null;
  return UUID_PATTERN.test(data.orderId) ? data.orderId : null;
}
```

Use a dynamic Expo adapter in this module or a thin `expo-notifications-client.ts` adapter so Node tests never import native Expo modules. The adapter must call `Notifications.setNotificationChannelAsync('new-orders', { importance: Notifications.AndroidImportance.MAX, ... })` before requesting Android permission, then call `getExpoPushTokenAsync({ projectId })`.

- [ ] **Step 4: Add the new source/test paths to the existing unit-test TypeScript project and run green**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="Expo token|well-formed new-order"`

Expected: PASS; the registration test proves only an optional side effect and the rejected permission/persistence test resolves successfully.

- [ ] **Step 5: Commit the isolated app lifecycle work**

```bash
git add apps/pappas-order-management/lib/push-notifications.types.ts \
  apps/pappas-order-management/lib/push-notifications.ts \
  apps/pappas-order-management/test/push-notifications.test.ts \
  apps/pappas-order-management/tsconfig.test.json
git commit -m "feat(app): add safe push device registration"
```

### Task 2: Wire Expo configuration and app startup without touching order flows

**Files:**
- Modify: `apps/pappas-order-management/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/pappas-order-management/app.config.js`
- Modify: `apps/pappas-order-management/app/_layout.tsx`
- Modify: `apps/pappas-order-management/test/push-notifications.test.ts`

**Interfaces:**
- Consumes: Task 1 `registerOrderManagementPushDevice` and `getOrderIdFromNotificationData`.
- Produces: notification registration only after `canAccessOrderManagement(userId)` has returned true; notification taps route to `/order-detail?orderId=<UUID>`.

- [ ] **Step 1: Extend the failing app-helper tests to document startup and navigation rules**

```ts
test('does not register a device before staff access is confirmed', async () => {
  const calls: string[] = [];
  await maybeRegisterPushDevice({ canAccess: false, register: async () => calls.push('register') }, 'staff-id');
  assert.deepEqual(calls, []);
});

test('maps a valid notification response to the order detail route', () => {
  assert.deepEqual(notificationRoute({ eventType: 'new_order', orderId: 'a0d7f897-b2c3-4b4e-90cf-67f259346ae2' }), {
    pathname: '/order-detail',
    params: { orderId: 'a0d7f897-b2c3-4b4e-90cf-67f259346ae2' },
  });
});
```

- [ ] **Step 2: Run the focused tests and verify they fail for the missing helpers**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="staff access|notification response"`

Expected: FAIL because `maybeRegisterPushDevice` and `notificationRoute` are not exported.

- [ ] **Step 3: Implement the helpers and integrate them at the existing post-auth boundary**

Install the SDK-compatible dependency with `pnpm --filter pappas-order-management exec expo install expo-notifications`. In `app.config.js`, add `expo-notifications` to `plugins` with a white transparent Android icon and `defaultChannel: 'new-orders'`; retain the existing user-owned EAS and Firebase `googleServicesFile` configuration.

In `_layout.tsx`, after the existing `canAccessOrderManagement(userId)` check succeeds, call the registration wrapper with `void` and a `.catch` guard. Add `Notifications.addNotificationResponseReceivedListener` plus `Notifications.getLastNotificationResponseAsync()` to navigate only for a validated `new_order` payload. Both listeners must be cleaned up on unmount. Do not alter `savePosOrder`, marketplace import functions, printer automation, or the existing auth redirects.

- [ ] **Step 4: Run focused tests and static validation**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="staff access|notification response|Expo token" && pnpm --filter pappas-order-management exec expo config --type public`

Expected: PASS; Expo config prints `expo-notifications` and `android.googleServicesFile` without exposing secrets.

- [ ] **Step 5: Commit only the app configuration/startup changes**

```bash
git add apps/pappas-order-management/package.json pnpm-lock.yaml \
  apps/pappas-order-management/app.config.js apps/pappas-order-management/app/_layout.tsx \
  apps/pappas-order-management/lib/push-notifications.ts \
  apps/pappas-order-management/test/push-notifications.test.ts
git commit -m "feat(app): register devices for order push alerts"
```

### Task 3: Persist isolated push devices and notification jobs

**Files:**
- Create: `supabase/migrations/20260811110000_add_order_push_notifications.sql`
- Create: `supabase/tests/order_push_notifications.sql`

**Interfaces:**
- Consumes: only an order ID received by the Edge Function after a completed order insert.
- Produces: standalone `public.order_management_push_devices` and `public.push_notification_jobs` tables. It does not modify `public.orders`.

- [ ] **Step 1: Write a failing SQL test for job creation and duplicate protection**

```sql
begin;
select plan(4);

insert into public.orders (id, order_number, customer_email, customer_phone, payment_method, subtotal, total)
values ('a0d7f897-b2c3-4b4e-90cf-67f259346ae2', 'TEST-1001', 'push-test@example.invalid', '0000000000', 'store', 10, 10);

select is((select count(*) from public.push_notification_jobs where order_id = 'a0d7f897-b2c3-4b4e-90cf-67f259346ae2'), 1::bigint, 'inserting an order creates exactly one push job');
select is((select status from public.push_notification_jobs where order_id = 'a0d7f897-b2c3-4b4e-90cf-67f259346ae2'), 'pending', 'new job is pending');
select is((select payload ->> 'eventType' from public.push_notification_jobs where order_id = 'a0d7f897-b2c3-4b4e-90cf-67f259346ae2'), 'new_order', 'payload is a new-order event');
select throws_ok($$insert into public.push_notification_jobs (order_id, event_type, payload) values ('a0d7f897-b2c3-4b4e-90cf-67f259346ae2', 'new_order', '{}')$$, '23505', 'duplicate logical order job is rejected');

select * from finish();
rollback;
```

- [ ] **Step 2: Run the SQL test against a local Supabase database and verify it fails before the migration exists**

Run: `supabase start && supabase db reset && supabase test db`

Expected: FAIL because `push_notification_jobs` does not exist.

- [ ] **Step 3: Implement the migration with local-only order-trigger behavior**

Create `order_management_push_devices` with `expo_push_token text unique not null`, `user_id uuid not null references public.profiles(id) on delete cascade`, `last_seen_at timestamptz not null default now()`, and timestamps. Enable RLS; permit authenticated staff/admin users to upsert only their own `user_id`, and permit no client table-wide device reads.

Create `push_notification_jobs` with a unique non-null `order_id uuid`, with no foreign key, `event_type text check (event_type = 'new_order')`, JSONB payload, `status text check (status in ('pending', 'sending', 'sent', 'failed')) default 'pending'`, bounded `attempt_count`, `next_attempt_at timestamptz not null default now()`, `last_error`, `sent_at`, and timestamps. Grant no client insert/update/delete access. The Edge Function receives the committed order record from the Dashboard webhook and inserts this job with `ON CONFLICT (order_id) DO NOTHING`.

- [ ] **Step 4: Re-run the local database test and inspect the trigger boundary**

Run: `supabase db reset && supabase test db && supabase db lint`

Expected: PASS; migration output contains no `ALTER TABLE public.orders`, no `CREATE TRIGGER`, and no function referencing `public.orders`.

- [ ] **Step 5: Commit the data model and trigger only**

```bash
git add supabase/migrations/20260811110000_add_order_push_notifications.sql \
  supabase/tests/order_push_notifications.sql
git commit -m "feat(db): queue new order push notifications"
```

### Task 4: Deliver and recover push jobs in a secured Edge Function

**Files:**
- Create: `supabase/functions/send-new-order-push/index.ts`
- Create: `supabase/functions/send-new-order-push/deno.json`
- Create: `supabase/functions/send-new-order-push/index_test.ts`

**Interfaces:**
- Consumes: Dashboard Database Webhook body `{ type: 'INSERT', record: { id: string, order_number: string, order_channel: string, total: number } }` or retry body `{ retry: true }`, `ORDER_PUSH_WEBHOOK_SECRET`, `EXPO_ACCESS_TOKEN`, and Task 3 tables.
- Produces: an HTTP 2xx response for recognized webhook events after job processing; jobs move to `sent`, retryable `failed`, or remain safely recoverable; `DeviceNotRegistered` tokens are removed.

- [ ] **Step 1: Write failing Deno tests for delivery outcomes**

```ts
Deno.test('marks the job sent when Expo accepts all active device messages', async () => {
  const harness = createHarness({ tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'], expoTickets: [{ status: 'ok', id: 'ticket-a' }, { status: 'ok', id: 'ticket-b' }] });
  const response = await handleNewOrderPushWebhook(harness.dependencies, validWebhookRequest('job-id'));
  assertEquals(response.status, 200);
  assertEquals(harness.jobUpdates, [{ status: 'sent', attempt_count: 1, last_error: null }]);
});

Deno.test('marks a transient Expo failure retryable without affecting the order', async () => {
  const harness = createHarness({ tokens: ['ExponentPushToken[a]'], expoFailure: new Error('network unavailable') });
  const response = await handleNewOrderPushWebhook(harness.dependencies, validWebhookRequest('job-id'));
  assertEquals(response.status, 202);
  assertEquals(harness.jobUpdates[0].status, 'failed');
  assertStringIncludes(harness.jobUpdates[0].last_error, 'network unavailable');
});

Deno.test('removes a device token Expo reports as unregistered', async () => {
  const harness = createHarness({ tokens: ['ExponentPushToken[old]'], expoTickets: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] });
  await handleNewOrderPushWebhook(harness.dependencies, validWebhookRequest('job-id'));
  assertEquals(harness.deletedTokens, ['ExponentPushToken[old]']);
});

Deno.test('processes only due failed jobs during a retry invocation', async () => {
  const harness = createHarness({ dueJobs: ['due-job'], futureJobs: ['future-job'] });
  const response = await handleNewOrderPushWebhook(harness.dependencies, validRetryRequest());
  assertEquals(response.status, 200);
  assertEquals(harness.processedJobIds, ['due-job']);
});
```

- [ ] **Step 2: Run the Deno test and verify it fails because the handler does not exist**

Run: `deno test --allow-env supabase/functions/send-new-order-push/index_test.ts`

Expected: FAIL with module-not-found or missing `handleNewOrderPushWebhook` export.

- [ ] **Step 3: Implement a secured, idempotent delivery handler**

The function must reject requests without `x-order-push-webhook-secret` matching `ORDER_PUSH_WEBHOOK_SECRET`. For a webhook record it validates the committed record then inserts or loads the standalone notification job; for `{ retry: true }` it loads a bounded batch of `pending` or `failed` jobs where `next_attempt_at <= now()` and `attempt_count < 5`. It returns 200 for an already sent job and uses a service-role Supabase client only inside the Edge Function. It must never query or mutate `orders`.

Before sending, atomically claim a pending/failed job with `status = 'sending'` and increment attempts. Query active tokens, build Expo messages using only the whitelist from Global Constraints, and POST batches of at most 100 messages to `https://exp.host/--/api/v2/push/send` with `Authorization: Bearer ${EXPO_ACCESS_TOKEN}` if configured. Never throw a remote send error past the handler: mark the job `failed`, set `next_attempt_at` using capped exponential backoff, store a sanitized error, and return 202. On success, inspect ticket errors, delete tokens with `DeviceNotRegistered`, and mark the job `sent` only after the Expo API accepted the batch.

Use bounded retries: retryable failures remain eligible for the scheduled retry only while `attempt_count < 5`; after five attempts preserve the error with `status = 'failed'` for operator visibility. This function never queries or mutates `orders`.

- [ ] **Step 4: Run Deno tests and a local function smoke test**

Run: `deno test --allow-env supabase/functions/send-new-order-push/index_test.ts && supabase functions serve send-new-order-push --no-verify-jwt`

Expected: tests PASS. With a valid secret header and fixture job, the local endpoint returns 200/202 and no `orders` row changes.

- [ ] **Step 5: Commit the Edge Function and its tests**

```bash
git add supabase/functions/send-new-order-push/index.ts \
  supabase/functions/send-new-order-push/deno.json \
  supabase/functions/send-new-order-push/index_test.ts
git commit -m "feat(push): deliver queued new order alerts"
```

### Task 5: Configure production delivery and prove the POS safety boundary

**Files:**
- Create: `docs/new-order-push-notifications-operations.md`
- Modify: `apps/pappas-order-management/README.md`

**Interfaces:**
- Consumes: deployed Task 4 function URL, supplied webhook secret, Expo access token, Firebase `google-services.json`, and FCM v1 service-account credential.
- Produces: reproducible operator configuration and a smoke-test checklist for two physical Android devices.

- [ ] **Step 1: Write the operations acceptance checks before documenting configuration**

```md
1. With Expo delivery intentionally unavailable, create a POS order and confirm it appears in Live Orders, can be printed, and can be paid/completed.
2. Confirm the same order creates a `push_notification_jobs` row whose status is `failed` or `pending`; the order row is unchanged.
3. Restore delivery and create a new order. Confirm both signed-in physical Android devices receive one alert and tapping it opens the matching order ID.
4. Revoke one device app/install it again, create a new order, and confirm an invalid token is removed without preventing the other device alert.
```

- [ ] **Step 2: Verify the documentation check fails because no operation guide exists**

Run: `test -f docs/new-order-push-notifications-operations.md`

Expected: FAIL with exit code 1.

- [ ] **Step 3: Write exact deployment and rollback instructions**

Document these exact actions:

```bash
supabase secrets set ORDER_PUSH_WEBHOOK_SECRET='<generated-long-random-value>'
supabase secrets set EXPO_ACCESS_TOKEN='<expo-access-token>'
supabase functions deploy send-new-order-push --no-verify-jwt
```

Then create a Supabase Dashboard Database Webhook named `send-new-order-push` for `public.push_notification_jobs` `INSERT`, targeting `https://<project-ref>.supabase.co/functions/v1/send-new-order-push`, with `x-order-push-webhook-secret` set to the same secret. Add a Supabase Cron Job that POSTs `{ "retry": true }` to the same function once per minute using the identical secret header; this is the recovery path for temporary Expo or function failures. Document FCM v1 credential upload to Expo, the ignored `google-services.json` local file, `pnpm --filter pappas-order-management build:android:apk`, notification permission grant, staff login, and the two-device acceptance checks.

Include rollback: disable/delete the Database Webhook first. This stops future notifications immediately while leaving all order/POS logic unchanged. Do not delete orders or alter the order trigger during rollback.

- [ ] **Step 4: Run the full verification suite and perform the two-device manual test**

Run: `pnpm --filter pappas-order-management test:unit && deno test --allow-env supabase/functions/send-new-order-push/index_test.ts && supabase db reset && supabase test db && pnpm --filter pappas-order-management exec expo config --type public`

Expected: all automated checks PASS. Record physical-device results, APK build number, and push job IDs in the operations document’s verification log.

- [ ] **Step 5: Commit docs and verified final state**

```bash
git add docs/new-order-push-notifications-operations.md apps/pappas-order-management/README.md
git commit -m "docs: add new order push notification operations"
```

## Plan self-review

- Spec coverage: Tasks 1–2 cover native registration, permission, deep linking, and non-crashing app behavior. Task 3 creates the durable outbox and isolates it from `orders`. Task 4 sends, retries, and removes invalid tokens. Task 5 covers FCM/Expo/Supabase setup, disabled-delivery safety verification, two-device acceptance, and rollback.
- Placeholder scan: no incomplete requirements remain; each task identifies exact files, interfaces, tests, commands, expected outcomes, and commit scope.
- Type consistency: `eventType: 'new_order'`, `orderId`, `push_notification_jobs`, `order_management_push_devices`, `send-new-order-push`, and `ORDER_PUSH_WEBHOOK_SECRET` are used consistently across all tasks.
