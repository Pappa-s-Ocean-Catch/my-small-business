# POS Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an iOS/Android Expo customer display that mirrors one POS register's active cart and can show a privacy-safe, store-wide live order queue while idle.

**Architecture:** A small workspace package owns the versioned mirror snapshot and queue projection contracts. The mother POS publishes debounced, latest-value-wins snapshots to one Supabase row keyed by its existing Smartpay Register ID; the new Expo app authenticates staff/admin users, restores local settings, fetches and subscribes to that row, and refreshes the store-wide queue from the existing order synchronization signal.

**Tech Stack:** TypeScript, React 19, React Native 0.81, Expo SDK 54, Supabase JS 2, AsyncStorage, React Native Paper, Node test runner, PostgreSQL/Supabase migrations and pgTAP-style SQL checks.

**Spec:** `docs/superpowers/specs/2026-09-16-pos-mirror-design.md`

## Global Constraints

- Work directly on `main`; preserve unrelated work and commit only files owned by each task.
- Scaffold `apps/pos-mirror` with the Expo CLI and pin it to Expo SDK 54 / React Native 0.81 compatibility.
- Support iOS and Android only; do not include a web script or web dependencies.
- Reuse `SmartpayPairingSettings.posRegisterId`; do not introduce a second mother-POS register identifier.
- Require Supabase email/password login and a `profiles.role_slug` of `staff` or `admin`.
- Keep the database contract to `register_id text primary key` and `current_order jsonb not null default '{}'::jsonb`.
- Never ship a Supabase service-role key in either app.
- Mirror failures are warning-only and must not block cart editing, payment, order creation, navigation, or printing.
- Active carts override both idle modes; successful completed checkout and explicit clear produce `{}`.
- A temporary Smartpay `pending_online_payment` save does not clear the mirror.
- Queue mode exposes only `order_number` and a customer-readable status; it must not expose customer, item, payment, address, marketplace, staff-note, or database-ID data.
- Queue eligibility matches existing Live Orders behavior and excludes closed, refunded, on-the-way, pending-online-payment, and not-yet-live scheduled orders.

---

### Task 1: Shared Mirror Contracts and Pure State Machines

**Files:**
- Create: `libs/pos-mirror/package.json`
- Create: `libs/pos-mirror/tsconfig.json`
- Create: `libs/pos-mirror/tsconfig.test.json`
- Create: `libs/pos-mirror/index.ts`
- Create: `libs/pos-mirror/src/snapshot.ts`
- Create: `libs/pos-mirror/src/latest-write-queue.ts`
- Create: `libs/pos-mirror/src/customer-queue.ts`
- Create: `libs/pos-mirror/test/snapshot.test.ts`
- Create: `libs/pos-mirror/test/latest-write-queue.test.ts`
- Create: `libs/pos-mirror/test/customer-queue.test.ts`

**Interfaces:**
- Consumes: no feature-specific interfaces.
- Produces: `MirrorOrderSnapshotV1`, `MirrorCartInput`, `buildMirrorOrderSnapshot(input, now?)`, `parseMirrorOrderSnapshot(value)`, `isEmptyMirrorOrder(value)`, `createLatestWriteQueue(write)`, `CustomerQueueCandidate`, and `buildCustomerQueue(candidates, nowMs?)`.

- [ ] **Step 1: Add package configuration and failing snapshot tests**

Create a private package named `@my-small-business/pos-mirror` with scripts:

```json
{
  "scripts": {
    "test": "rm -rf dist-test && tsc -p tsconfig.test.json && node --test dist-test/test/**/*.test.js",
    "type-check": "tsc -p tsconfig.json --noEmit"
  }
}
```

Write tests covering quantity-summed `itemCount`, two-decimal currency normalization, empty-cart `{}`, parser rejection of unsupported versions/non-finite values, and accepted V1 snapshots. A representative assertion is:

```ts
const snapshot = buildMirrorOrderSnapshot({
  items: [{ id: 'line-1', name: 'Fish Pack', quantity: 2, unitPrice: 12.5, lineTotal: 25 }],
  subtotal: 25,
  discount: 0,
  total: 25,
}, () => new Date('2026-09-16T00:00:00.000Z'));
assert.deepEqual(snapshot, {
  version: 1,
  updatedAt: '2026-09-16T00:00:00.000Z',
  itemCount: 2,
  items: [{ id: 'line-1', name: 'Fish Pack', quantity: 2, unitPrice: 12.5, lineTotal: 25 }],
  subtotal: 25,
  discount: 0,
  total: 25,
});
```

- [ ] **Step 2: Run the snapshot tests and confirm RED**

Run: `pnpm --filter @my-small-business/pos-mirror test`

Expected: FAIL because the package implementation exports do not exist yet.

- [ ] **Step 3: Implement the versioned snapshot contract**

Implement strict finite-number checks, trimmed non-empty names, integer quantities greater than zero, two-decimal rounding, and the exact empty object for empty carts. Use discriminating `version: 1` and return `null` from `parseMirrorOrderSnapshot` for invalid values.

```ts
export type MirrorOrderSnapshotV1 = {
  version: 1;
  updatedAt: string;
  itemCount: number;
  items: MirrorOrderLine[];
  subtotal: number;
  discount: number;
  total: number;
};

export function isEmptyMirrorOrder(value: unknown): value is Record<string, never> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value as object).length === 0;
}
```

- [ ] **Step 4: Add failing latest-write and customer-queue tests**

Cover these scenarios:

```ts
test('coalesces pending values and writes the latest value after the active write', async () => {
  const writes: string[] = [];
  const gates: Array<() => void> = [];
  const queue = createLatestWriteQueue(async (value: string) => {
    writes.push(value);
    await new Promise<void>((resolve) => gates.push(resolve));
  });
  queue.request('first');
  queue.request('second');
  queue.request('latest');
  gates.shift()?.();
  await queue.flush();
  assert.deepEqual(writes, ['first', 'latest']);
});
```

Queue tests must verify closed/refunded/on-the-way/pending-online-payment/future scheduled exclusion, oldest-first ordering, and projection to `{ orderNumber, status, sortAt }` only.

- [ ] **Step 5: Run the new tests and confirm RED**

Run: `pnpm --filter @my-small-business/pos-mirror test`

Expected: FAIL because `createLatestWriteQueue` and `buildCustomerQueue` are not implemented.

- [ ] **Step 6: Implement write serialization and queue projection**

`createLatestWriteQueue<T>` must allow only one write in flight, replace any pending value with the newest request, expose `flush(): Promise<void>`, and keep accepting future requests after a rejected write. `buildCustomerQueue` must encode the same 30-minute preorder lead rule as `PRE_ORDER_LEAD_MINUTES`, map statuses to `Pending`, `Confirmed`, `Preparing`, and `Ready`, and return no private fields.

- [ ] **Step 7: Run package verification**

Run:

```bash
pnpm --filter @my-small-business/pos-mirror test
pnpm --filter @my-small-business/pos-mirror type-check
```

Expected: all shared-package tests pass and TypeScript exits 0.

- [ ] **Step 8: Commit Task 1**

```bash
git add libs/pos-mirror
git commit -m "feat: add POS mirror shared contracts"
```

---

### Task 2: Supabase Mirror State and Authorization

**Files:**
- Create: `supabase/migrations/20260916120000_add_pos_mirror_state.sql`
- Create: `supabase/tests/pos_mirror_state.sql`

**Interfaces:**
- Consumes: authenticated users and `public.profiles.role_slug` values already present in Supabase.
- Produces: `public.pos_mirror_state(register_id, current_order)`, staff/admin RLS, Realtime publication, and staff/admin access to `public.order_sync_state`.

- [ ] **Step 1: Write the SQL regression test first**

The transaction-wrapped test must assert:

```sql
SELECT has_table('public', 'pos_mirror_state');
SELECT col_is_pk('public', 'pos_mirror_state', 'register_id');
SELECT col_type_is('public', 'pos_mirror_state', 'current_order', 'jsonb');
SELECT is((SELECT current_order FROM public.pos_mirror_state WHERE register_id = 'test-register'), '{}'::jsonb);
```

Create temporary authenticated staff, admin, and customer profiles and use `set_config('request.jwt.claim.sub', user_id::text, true)` plus `SET LOCAL ROLE authenticated` to prove staff/admin can select/upsert while a customer cannot. Assert `pg_publication_tables` contains `pos_mirror_state`.

- [ ] **Step 2: Run the SQL test and confirm RED**

Run: `supabase test db supabase/tests/pos_mirror_state.sql`

Expected: FAIL because `public.pos_mirror_state` does not exist. If local PostgreSQL is unavailable, record the connection failure and continue with static migration checks; do not call the SQL behavior verified.

- [ ] **Step 3: Implement the migration**

Create the table and policies with a shared role predicate:

```sql
CREATE TABLE IF NOT EXISTS public.pos_mirror_state (
  register_id TEXT PRIMARY KEY,
  current_order JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.pos_mirror_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY pos_mirror_state_staff_admin_select
ON public.pos_mirror_state FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid()
    AND profiles.role_slug IN ('staff', 'admin')
));
```

Add matching INSERT and UPDATE policies, no DELETE policy, an idempotent Realtime publication block, `REPLICA IDENTITY FULL`, and replace the existing `order_sync_state_staff_select` policy with a staff-or-admin policy.

- [ ] **Step 4: Run SQL and static verification**

Run:

```bash
supabase test db supabase/tests/pos_mirror_state.sql
rg -n "pos_mirror_state|staff|admin|supabase_realtime|REPLICA IDENTITY FULL" supabase/migrations/20260916120000_add_pos_mirror_state.sql
```

Expected: SQL test passes when local Supabase is available; static output contains all required schema/security/publication clauses.

- [ ] **Step 5: Commit Task 2**

```bash
git add supabase/migrations/20260916120000_add_pos_mirror_state.sql supabase/tests/pos_mirror_state.sql
git commit -m "feat: add POS mirror realtime state"
```

---

### Task 3: Non-Blocking Mother-POS Publisher

**Files:**
- Create: `apps/pappas-order-management/lib/pos-mirror-publisher.ts`
- Create: `apps/pappas-order-management/hooks/usePosMirrorPublisher.ts`
- Create: `apps/pappas-order-management/test/pos-mirror-publisher.test.ts`
- Modify: `apps/pappas-order-management/app/pos.tsx`
- Modify: `apps/pappas-order-management/package.json`
- Modify: `apps/pappas-order-management/tsconfig.json`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**
- Consumes: `buildMirrorOrderSnapshot`, `createLatestWriteQueue`, `loadSmartpayRegisterId`, POS `cartItems`, and computed totals/discounts.
- Produces: `createPosMirrorPublisher({ loadRegisterId, upsert, debounceMs })`, `usePosMirrorPublisher(input)`, `publishCurrentCart()`, and `clearMirrorAfterCheckout()`.

- [ ] **Step 1: Add the shared package dependency and failing publisher tests**

Add `"@my-small-business/pos-mirror": "workspace:*"`. Test a dependency-injected publisher rather than the Supabase singleton:

```ts
test('debounces cart changes and publishes only the newest snapshot', async () => {
  const rows: unknown[] = [];
  const publisher = createPosMirrorPublisher({
    loadRegisterId: async () => 'register-1',
    upsert: async (row) => { rows.push(row); },
    debounceMs: 10,
  });
  publisher.schedule(snapshotA);
  publisher.schedule(snapshotB);
  await publisher.flush();
  assert.deepEqual(rows, [{ register_id: 'register-1', current_order: snapshotB }]);
});
```

Also test `{}` clearing, upsert failure followed by later recovery, register ID caching, and no thrown error reaching callers.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: the new test fails because the publisher does not exist; the broader compile may additionally report the known unrelated printer-native baseline errors.

- [ ] **Step 3: Implement the publisher and hook**

Use a stable publisher instance, a short debounce, and the shared serialized latest-write queue. The Supabase adapter performs:

```ts
await supabase.from('pos_mirror_state').upsert({
  register_id: registerId,
  current_order: snapshot,
}, { onConflict: 'register_id' });
```

Failures are logged with register ID redacted to a short suffix and are swallowed after the queue records completion. The hook schedules whenever cart/totals change and exposes an awaited `clearMirrorAfterCheckout()` that queues `{}` and flushes without throwing into checkout.

- [ ] **Step 4: Integrate the hook into `pos.tsx`**

Build line inputs from `getPosCartItemDisplayName(item)`, `quantity`, effective unit price, and `subtotal`. Use `discountAmount + freeItemDiscountAmount + rewardPointsValue` as the displayed discount and `totals.total` as final total.

Call `clearMirrorAfterCheckout()` immediately before the success navigation/reset in:

- pickup create/update after reward-point/coupon work;
- Smartpay instore only after settlement and receipt workflow succeeds;
- settlement of an existing pending instore order;
- normal instore after the order and post-save work complete;
- third-party after `savePosOrder` succeeds;
- delivery after checkout-session creation succeeds and before `resetPosForNextOrder()`.

Do not clear after `createOrReusePendingInstoreOrder`, failed/cancelled checkout, or component unmount. Explicit Clear Cart is covered by the empty-cart observer.

- [ ] **Step 5: Run focused publisher and structural checkout tests**

Run the emitted publisher test directly if baseline compilation blocks the full suite:

```bash
pnpm --filter pappas-order-management exec tsc -p tsconfig.test.json --pretty false
node --test apps/pappas-order-management/dist-test/apps/pappas-order-management/test/pos-mirror-publisher.test.js
```

Add source assertions proving each success path invokes `clearMirrorAfterCheckout` after its final success boundary and that the pending Smartpay creation block does not invoke it.

- [ ] **Step 6: Commit Task 3**

```bash
git add apps/pappas-order-management/app/pos.tsx apps/pappas-order-management/hooks/usePosMirrorPublisher.ts apps/pappas-order-management/lib/pos-mirror-publisher.ts apps/pappas-order-management/test/pos-mirror-publisher.test.ts apps/pappas-order-management/package.json apps/pappas-order-management/tsconfig.json apps/pappas-order-management/tsconfig.test.json pnpm-lock.yaml
git commit -m "feat: publish POS carts to mirror displays"
```

---

### Task 4: CLI Scaffold, Authentication, and Persistent Settings

**Files:**
- Create via CLI then edit: `apps/pos-mirror/*`
- Create: `apps/pos-mirror/src/lib/supabase.ts`
- Create: `apps/pos-mirror/src/lib/auth.ts`
- Create: `apps/pos-mirror/src/lib/settings.ts`
- Create: `apps/pos-mirror/src/screens/LoginScreen.tsx`
- Create: `apps/pos-mirror/src/screens/SettingsScreen.tsx`
- Create: `apps/pos-mirror/test/settings.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, AsyncStorage, and `profiles.role_slug`.
- Produces: `MirrorSettings { registerId: string; idleMode: 'image' | 'queue' }`, `loadMirrorSettings()`, `saveMirrorSettings()`, `canAccessPosMirror(userId)`, and authenticated app states.

- [ ] **Step 1: Scaffold with Expo CLI**

Run:

```bash
pnpm dlx create-expo-app@latest apps/pos-mirror --template blank-typescript --yes
```

Pin package versions to the repository's Expo SDK 54 / React 19 / React Native 0.81 line. Remove generated web dependencies and the web script. Add AsyncStorage, Supabase JS, React Native Paper, safe-area context, `expo-keep-awake`, and `@my-small-business/pos-mirror`. Set app name `POS Mirror`, slug `pos-mirror`, landscape orientation, tablet support, and unique iOS/Android identifiers.

- [ ] **Step 2: Add failing settings tests**

Test normalization independently from AsyncStorage:

```ts
assert.deepEqual(normalizeMirrorSettings({ registerId: '  abc-123  ', idleMode: 'queue' }), {
  registerId: 'abc-123',
  idleMode: 'queue',
});
assert.deepEqual(normalizeMirrorSettings({}), { registerId: '', idleMode: 'image' });
```

- [ ] **Step 3: Run tests and confirm RED**

Run: `pnpm --filter pos-mirror test:unit`

Expected: FAIL because settings normalization/persistence is missing.

- [ ] **Step 4: Implement Supabase, authorization, and settings**

Configure Supabase with persisted AsyncStorage sessions, `autoRefreshToken: true`, and `detectSessionInUrl: false`. `canAccessPosMirror` must select only `role_slug` and accept exactly `staff` or `admin`. Store settings under `pos-mirror.settings.v1`, trim Register ID, and default invalid modes to `image`.

- [ ] **Step 5: Implement login and settings screens**

Login uses email/password, signs out unauthorized users, and displays non-sensitive errors. Settings requires a non-empty Register ID before entering display mode, offers Image and Current Queue choices, persists them, and provides Sign Out. Do not log passwords, access tokens, refresh tokens, or the anon key.

- [ ] **Step 6: Add root auth/session state flow**

`App.tsx` restores the session, subscribes to `onAuthStateChange`, verifies authorization, and renders exactly one of loading, login, settings, or display. A saved authorized session with an empty Register ID opens settings; a valid saved configuration opens display.

- [ ] **Step 7: Verify the scaffold and settings slice**

Run:

```bash
pnpm --filter pos-mirror test:unit
pnpm --filter pos-mirror typecheck
pnpm --filter pos-mirror exec expo config --type public
```

Expected: tests and typecheck pass; Expo config reports iOS/Android landscape app metadata and no web script exists.

- [ ] **Step 8: Commit Task 4**

```bash
git add apps/pos-mirror package.json pnpm-lock.yaml
git commit -m "feat: scaffold authenticated POS mirror app"
```

---

### Task 5: Mirror Cart and Queue Synchronization

**Files:**
- Create: `apps/pos-mirror/src/lib/mirror-state.ts`
- Create: `apps/pos-mirror/src/lib/customer-queue.ts`
- Create: `apps/pos-mirror/src/lib/reconcile.ts`
- Create: `apps/pos-mirror/src/hooks/useMirrorState.ts`
- Create: `apps/pos-mirror/src/hooks/useCustomerQueue.ts`
- Create: `apps/pos-mirror/test/reconcile.test.ts`
- Create: `apps/pos-mirror/test/customer-queue.test.ts`

**Interfaces:**
- Consumes: Supabase client, configured Register ID, shared `parseMirrorOrderSnapshot`, shared `buildCustomerQueue`, and `order_sync_state`.
- Produces: `{ snapshot, status, warning }` from `useMirrorState(registerId)` and `{ orders, status, warning }` from `useCustomerQueue(enabled)`.

- [ ] **Step 1: Add failing reconciliation tests**

Use a pure reconciler that compares valid snapshot `updatedAt` timestamps:

```ts
assert.equal(reconcileSnapshot(newerRealtime, olderFetch), newerRealtime);
assert.equal(reconcileSnapshot(null, validFetch), validFetch);
assert.equal(reconcileSnapshot(validCurrent, invalidIncoming), validCurrent);
```

Add tests for a missing row becoming idle, a register-filtered event, and cleanup unsubscribing both channels.

- [ ] **Step 2: Run tests and confirm RED**

Run: `pnpm --filter pos-mirror test:unit`

Expected: FAIL because reconciliation and service functions do not exist.

- [ ] **Step 3: Implement cart-state fetch and subscription**

Subscribe first to `postgres_changes` UPDATE/INSERT events on `public.pos_mirror_state` with filter `register_id=eq.<configured-id>`, then fetch `.select('register_id,current_order').eq('register_id', registerId).maybeSingle()`. Reconcile by `updatedAt`, treat no row/`{}` as idle, and refetch whenever the channel returns to `SUBSCRIBED` after a prior disconnect.

- [ ] **Step 4: Add failing customer-queue service tests**

Assert the query select list is exactly:

```text
order_number,created_at,scheduled_pickup_at,order_status,payment_status
```

Test that an `order_sync_state` update schedules one debounced refetch, reconnect refetches, queue mode disabled performs no query, and the last valid queue survives a transient fetch failure.

- [ ] **Step 5: Implement minimal queue query and sync signal**

Query open orders within the existing 14-day lookback, exclude closed/pending-payment/refunded rows server-side, then apply shared live-window projection client-side. Subscribe only to UPDATE on `public.order_sync_state`, debounce refetch by 250 ms, and refetch after reconnection. Never select `id`, customer, item, address, payment-method, or note columns.

- [ ] **Step 6: Verify synchronization logic**

Run:

```bash
pnpm --filter pos-mirror test:unit
pnpm --filter pos-mirror typecheck
```

Expected: all app tests and typecheck pass.

- [ ] **Step 7: Commit Task 5**

```bash
git add apps/pos-mirror/src/lib apps/pos-mirror/src/hooks apps/pos-mirror/test
git commit -m "feat: sync mirror carts and customer queue"
```

---

### Task 6: Full-Screen Customer Display UI

**Files:**
- Create: `apps/pos-mirror/src/components/ActiveCartDisplay.tsx`
- Create: `apps/pos-mirror/src/components/CustomerQueueDisplay.tsx`
- Create: `apps/pos-mirror/src/components/IdleImageDisplay.tsx`
- Create: `apps/pos-mirror/src/components/ConnectionBanner.tsx`
- Create: `apps/pos-mirror/src/screens/DisplayScreen.tsx`
- Create: `apps/pos-mirror/src/theme.ts`
- Create: `apps/pos-mirror/test/display-state.test.ts`
- Modify: `apps/pos-mirror/App.tsx`

**Interfaces:**
- Consumes: authenticated session, `MirrorSettings`, `useMirrorState`, and `useCustomerQueue`.
- Produces: a landscape-first full-screen UI and a pure `selectDisplayState(snapshot, idleMode, queue)` decision.

- [ ] **Step 1: Add failing display precedence tests**

Cover the full matrix:

```ts
assert.equal(selectDisplayState(activeSnapshot, 'queue', queue).kind, 'cart');
assert.equal(selectDisplayState(null, 'queue', queue).kind, 'queue');
assert.equal(selectDisplayState(null, 'queue', []).kind, 'image');
assert.equal(selectDisplayState(null, 'image', queue).kind, 'image');
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `pnpm --filter pos-mirror test:unit`

Expected: FAIL because display-state selection is missing.

- [ ] **Step 3: Implement the display-state selector and components**

`ActiveCartDisplay` uses a scrollable left item rail and a fixed right totals panel, showing quantity, item name, unit price, line total, summed item count, subtotal, optional discount, and dominant total. `CustomerQueueDisplay` uses large order-number/status rows sorted oldest first. `IdleImageDisplay` uses a branded gradient/color placeholder and a replaceable image slot without requiring the final artwork.

- [ ] **Step 4: Add full-screen behavior and settings access**

Call `useKeepAwake()`, hide the status bar, honor safe areas, and use `useWindowDimensions()` for rotation-safe sizing. Add an unobtrusive top-corner settings icon with an accessible label and a deliberate long-press fallback on the idle background. No queue or cart row is interactive.

- [ ] **Step 5: Add resilient status presentation**

Keep the last valid cart/queue mounted during reconnecting states and overlay a small banner. Show a discreet waiting indicator when the register row does not exist. Authentication loss is handled by the root app and returns to login. Invalid snapshot warnings contain no raw payload.

- [ ] **Step 6: Verify UI code and Expo bundling**

Run:

```bash
pnpm --filter pos-mirror test:unit
pnpm --filter pos-mirror typecheck
pnpm --filter pos-mirror exec expo export --platform android --output-dir /tmp/pos-mirror-export-android
pnpm --filter pos-mirror exec expo export --platform ios --output-dir /tmp/pos-mirror-export-ios
```

Expected: tests/typecheck pass and both native bundles export successfully.

- [ ] **Step 7: Commit Task 6**

```bash
git add apps/pos-mirror
git commit -m "feat: add POS mirror customer display"
```

---

### Task 7: Cross-App Verification and Handoff

**Files:**
- Modify if required by findings: files already listed in Tasks 1-6 only.

**Interfaces:**
- Consumes: all completed tasks.
- Produces: verified repository state and an explicit device/database verification boundary.

- [ ] **Step 1: Run shared and mirror app verification**

Run:

```bash
pnpm --filter @my-small-business/pos-mirror test
pnpm --filter @my-small-business/pos-mirror type-check
pnpm --filter pos-mirror test:unit
pnpm --filter pos-mirror typecheck
pnpm --filter pos-mirror exec expo config --type public
```

Expected: all commands exit 0.

- [ ] **Step 2: Run mother-POS focused verification**

Run the POS test command and, if its known printer-native compile baseline blocks execution, emit and execute only the new mirror tests while preserving the exact failure output for handoff:

```bash
pnpm --filter pappas-order-management test:unit
```

Expected: new mirror tests pass; unrelated baseline failures, if still present, are reported separately.

- [ ] **Step 3: Run database verification**

Run:

```bash
supabase test db supabase/tests/pos_mirror_state.sql
supabase test db supabase/tests/order_sync_state.sql
```

Expected: both pass when local Supabase is running. A connection refusal remains unverified database behavior, not a pass.

- [ ] **Step 4: Run repository hygiene checks**

Run:

```bash
git diff --check
git status --short
git log --oneline -10
```

Expected: no whitespace errors, only intended files modified, and task commits present.

- [ ] **Step 5: Perform implementation review**

Review the diff against every acceptance criterion in the spec. In particular, inspect all six POS checkout boundaries, prove the Smartpay pending creation does not clear, verify the queue select list contains no private columns, and verify no secret or `.env` file is tracked.

- [ ] **Step 6: Commit any verification-only corrections**

If review found a scoped defect, fix it with its failing regression test and commit only those files:

```bash
git add apps/pos-mirror libs/pos-mirror apps/pappas-order-management/app/pos.tsx apps/pappas-order-management/hooks/usePosMirrorPublisher.ts apps/pappas-order-management/lib/pos-mirror-publisher.ts apps/pappas-order-management/test/pos-mirror-publisher.test.ts supabase/migrations/20260916120000_add_pos_mirror_state.sql supabase/tests/pos_mirror_state.sql
git commit -m "fix: complete POS mirror verification"
```

- [ ] **Step 7: Record release boundaries in the final handoff**

State separately:

- code/tests that passed;
- whether the migration was applied to a real Supabase environment;
- whether iOS and Android native bundles/builds were produced;
- whether physical-device full-screen, rotation, keep-awake, long-running Realtime reconnect, and mother-POS-to-mirror behavior were exercised;
- that supplying and validating the final idle image remains a later asset replacement.
