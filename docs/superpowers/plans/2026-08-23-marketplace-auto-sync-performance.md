# Marketplace Auto-Sync Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each POS tablet disable automatic marketplace sync immediately while making the remaining automatic sync bounded, status-only for existing orders, and measurable.

**Architecture:** Persist a device-local `marketplaceAutoSyncEnabled` preference and gate the existing foreground coordinator on both authenticated access and hydrated settings. Refactor automatic work to use a maximum-two-job queue and a local order summary; only new orders use the full importer, while existing orders use a status-only service path. Add safe timing diagnostics around both client polls and the server `/active` route.

**Tech Stack:** Expo/React Native, Zustand, AsyncStorage, TypeScript, Node test runner, Supabase, Next.js route handlers.

**Spec:** `docs/superpowers/specs/2026-08-23-pos-marketplace-sync-performance-design.md`

## Global Constraints

- Default the per-tablet auto-sync preference to `true`; stored settings without the field normalise to `true`.
- Disabled means no new automatic poll, import, or automatic status write; manual marketplace actions remain available.
- Do not cancel unknown in-flight provider fetches; invalidate the automatic run and check that token before any local import/status write.
- Keep foreground-only operation, the Melbourne 11:00–20:00 guard, 15-second cadence, and no overlapping polls.
- Limit automatic detail/import/status jobs to exactly two concurrent jobs across Uber Eats and DoorDash.
- Never expose marketplace credentials, cookies, or customer payloads in diagnostics.
- Preserve the existing trimmed provider/external-order ID identity and database idempotency guard.
- Leave implementation changes uncommitted unless the user explicitly requests a commit.

---

## File Structure

- Modify `apps/pappas-order-management/lib/settings.ts`: own the persisted preference, default, migration normalisation, and save normalisation.
- Create `apps/pappas-order-management/providers/MarketplaceSyncGate.tsx`: combine staff authentication and hydrated device settings before enabling the existing provider.
- Modify `apps/pappas-order-management/app/_layout.tsx`: retain only authenticated-access state and render the gate inside `AppSettingsProvider`.
- Modify `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx`: expose and save the switch.
- Create `apps/pappas-order-management/test/marketplace-auto-sync-settings.test.ts`: verify default/migration and settings-screen wiring.
- Modify `apps/pappas-order-management/lib/orders.ts`: add a small provider/external-ID local summary lookup.
- Modify `apps/pappas-order-management/lib/marketplace-pos-order.ts`: expose a status-only update operation for an already-known local order summary.
- Modify `apps/pappas-order-management/lib/marketplace-sync.ts`: add generation invalidation, a shared two-job queue, summary-first dispatch, and non-sensitive diagnostics.
- Modify `apps/pappas-order-management/providers/MarketplaceSyncProvider.tsx`: inject the summary lookup and client diagnostic recorder.
- Modify `apps/pappas-order-management/test/marketplace-sync.test.ts` and `apps/pappas-order-management/test/marketplace-pos-order.test.ts`: cover queue, invalidation, unchanged status, and existing-order writes.
- Create `apps/web/src/lib/marketplace-active-timing.ts` and `apps/web/src/lib/marketplace-active-timing.test.ts`: define/test timing-field construction without exercising real provider calls.
- Modify `apps/web/src/app/api/marketplace/providers/[provider]/active/route.ts`: measure and emit safe stage timings for auth, credential lookup, provider fetch, and total response time.

### Task 1: Persist and gate the per-tablet preference

**Files:**
- Create: `apps/pappas-order-management/providers/MarketplaceSyncGate.tsx`
- Create: `apps/pappas-order-management/test/marketplace-auto-sync-settings.test.ts`
- Modify: `apps/pappas-order-management/lib/settings.ts`
- Modify: `apps/pappas-order-management/app/_layout.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx`

**Interfaces:**
- Produces `AppSettings.marketplaceAutoSyncEnabled: boolean` and `MarketplaceSyncGate({ authenticated, children })`.
- Consumes `useAppSettingsQuery()` and `MarketplaceSyncProvider`.

- [ ] **Step 1: Write the failing settings/gate tests**

```ts
test('normalises missing marketplace auto-sync settings to enabled', () => {
  assert.equal(normalizeAppSettings({}).marketplaceAutoSyncEnabled, true);
  assert.equal(normalizeAppSettings({ marketplaceAutoSyncEnabled: false }).marketplaceAutoSyncEnabled, false);
});

test('settings screen saves the marketplace auto-sync preference', () => {
  assert.match(source, /marketplaceAutoSyncEnabled/);
  assert.match(source, /Marketplace auto-sync/);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "marketplace auto-sync"`

Expected: FAIL because `normalizeAppSettings` and the Settings-screen switch do not exist.

- [ ] **Step 3: Implement setting normalisation and UI wiring**

```ts
export function normalizeAppSettings(parsed: Partial<AppSettings> | null): AppSettings {
  const marketplaceAutoSyncEnabled = typeof parsed?.marketplaceAutoSyncEnabled === 'boolean'
    ? parsed.marketplaceAutoSyncEnabled
    : true;
  return { /* existing normalised fields */, marketplaceAutoSyncEnabled };
}
```

Add a `marketplaceAutoSyncEnabled` state value in Settings, hydrate it from `currentSettings`, save it with the other settings, and add a `Marketplace auto-sync` switch whose helper text says manual marketplace actions remain available.

- [ ] **Step 4: Add the hydration-safe root gate**

```tsx
export function MarketplaceSyncGate({ authenticated, children }: PropsWithChildren<{ authenticated: boolean }>) {
  const { data: settings, isLoading } = useAppSettingsQuery();
  return (
    <MarketplaceSyncProvider enabled={!isLoading && authenticated && settings.marketplaceAutoSyncEnabled}>
      {children}
    </MarketplaceSyncProvider>
  );
}
```

Replace the root layout's direct provider with this gate. Keep its existing session/access checks, but rename the state to communicate authenticated staff access rather than a settings decision.

- [ ] **Step 5: Run focused settings tests**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "marketplace auto-sync"`

Expected: PASS.

### Task 2: Add lightweight existing-order status reconciliation

**Files:**
- Modify: `apps/pappas-order-management/lib/orders.ts`
- Modify: `apps/pappas-order-management/lib/marketplace-pos-order.ts`
- Modify: `apps/pappas-order-management/test/marketplace-pos-order.test.ts`

**Interfaces:**
- Produces `findMarketplaceOrderSummary(provider, externalOrderId): Promise<{ data: MarketplaceOrderSummary | null; error: string | null }>` where `MarketplaceOrderSummary` is `{ id: string; order_status: OrderStatus }`.
- Produces `syncExistingMarketplaceOrderStatus(order: MarketplaceOrderSummary, detail): Promise<{ order: Order | null; error: string | null }>`.
- Consumes `getMarketplaceOrderStatus` and `shouldReconcileMarketplaceOrderStatus`.

- [ ] **Step 1: Write failing service tests**

```ts
test('does not write when an existing summary already has the mapped marketplace status', async () => {
  const result = await service.syncExistingMarketplaceOrderStatus(
    { id: 'pos-existing', order_status: 'ready' }, detail,
  );
  assert.equal(result.error, null);
  assert.equal(updateCalls.length, 0);
});

test('updates only order_status for a changed existing summary', async () => {
  await service.syncExistingMarketplaceOrderStatus({ id: 'pos-existing', order_status: 'confirmed' }, detail);
  assert.deepEqual(updateCalls, [{ orderId: 'pos-existing', update: { order_status: 'ready' } }]);
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "existing summary"`

Expected: FAIL because `syncExistingMarketplaceOrderStatus` is not exposed.

- [ ] **Step 3: Add the summary read and status-only service method**

Use the same canonical provider name and trimmed-ID fallback rules as `findMarketplaceOrder`, but select only `id`, `order_status`, and `external_order_number`. Make the service method compute the upstream status from `detail`, call `shouldReconcileMarketplaceOrderStatus`, and call `updateMarketplaceOrder(order.id, { order_status })` only when it returns true. Do not call `findMarketplaceOrder` or load items/add-ons in this path.

- [ ] **Step 4: Keep manual sync behaviour unchanged**

Leave `syncMarketplaceOrderOnDemand` and the public `syncMarketplaceOrderStatus(provider, externalOrderId, detail)` intact. They retain their current full lookup path because manual staff actions are not part of the automatic performance control.

- [ ] **Step 5: Run focused service tests**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "existing summary"`

Expected: PASS.

### Task 3: Bound automatic work and suppress invalidated writes

**Files:**
- Modify: `apps/pappas-order-management/lib/marketplace-sync.ts`
- Modify: `apps/pappas-order-management/providers/MarketplaceSyncProvider.tsx`
- Modify: `apps/pappas-order-management/test/marketplace-sync.test.ts`

**Interfaces:**
- Consumes `findMarketplaceOrderSummary` and `syncExistingMarketplaceOrderStatus` from Task 2.
- Produces coordinator methods `start(): Promise<void>`, `stop(): void`, and `poll(): Promise<void>` with maximum two automatic jobs in progress.

- [ ] **Step 1: Write failing coordinator tests**

```ts
test('never runs more than two automatic detail jobs at once', async () => {
  // Return three active orders and hold each detail promise.
  await coordinator.poll();
  assert.equal(maxConcurrentDetails, 2);
});

test('stopping an automatic run prevents its later detail result from writing', async () => {
  const poll = coordinator.poll();
  await detailStarted;
  coordinator.stop();
  releaseDetail();
  await poll;
  assert.equal(importCalls, 0);
  assert.equal(statusWrites, 0);
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "two automatic|prevents its later"`

Expected: FAIL because work fans out through `Promise.all` and `stop()` does not invalidate a run.

- [ ] **Step 3: Implement shared queue and generation guard**

Add `findMarketplaceOrderSummary` and `syncExistingMarketplaceOrderStatus` dependencies. Capture `const generation = runGeneration` at poll start; increment `runGeneration` in `stop()`. Build one job array from both providers' active and missing-history rows, then process it through a two-worker loop:

```ts
async function runBounded<T>(jobs: Array<() => Promise<T>>, limit = 2): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    while (next < jobs.length) await jobs[next++]();
  }));
}
```

For an active order, read the local summary, fetch provider detail, check `generation === runGeneration`, then call the full importer only if no summary exists; otherwise call the status-only method. Perform the same generation check immediately before history status reconciliation. Preserve individual job error logging and provider-list error isolation.

- [ ] **Step 4: Record non-sensitive poll diagnostics**

Extend dependencies with optional `onPollComplete(event)` and report provider request duration, active count, queued count, unchanged-status count, completed-job count, and failure count. In `MarketplaceSyncProvider`, send only those numeric fields plus the local enabled state to the existing New Relic client; do not include IDs, customer names, errors containing provider payloads, cookies, or details.

- [ ] **Step 5: Run focused coordinator tests**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "marketplace|automatic"`

Expected: PASS, including current interval, business-hours, overlap, provider-isolation, and history tests.

### Task 4: Add server-side `/active` timing visibility

**Files:**
- Create: `apps/web/src/lib/marketplace-active-timing.ts`
- Create: `apps/web/src/lib/marketplace-active-timing.test.ts`
- Modify: `apps/web/src/app/api/marketplace/providers/[provider]/active/route.ts`

**Interfaces:**
- Produces `createMarketplaceActiveTiming(provider)` with `mark(stage)` and `toLogFields(status)`; output fields are provider, HTTP status, and numeric durations only.

- [ ] **Step 1: Write the failing pure timing test**

```ts
test('emits only provider, status, and non-negative numeric timing fields', () => {
  const timing = createMarketplaceActiveTiming('uber_eats', () => 100);
  timing.mark('authenticated');
  const fields = timing.toLogFields(200);
  assert.deepEqual(fields, { provider: 'uber_eats', status: 200, authMs: 0, credentialsMs: 0, providerFetchMs: 0, totalMs: 0 });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `cd apps/web && node --experimental-strip-types --test src/lib/marketplace-active-timing.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement timing helper and route instrumentation**

Call `mark('authenticated')` immediately after `authenticateMarketplaceRequest`, `mark('credentials')` after cookies/config are available, and `mark('providerFetch')` after the Uber or DoorDash upstream request resolves. In a `finally` block, call `console.info('[marketplace-active-timing]', timing.toLogFields(responseStatus))`. Preserve each current response body/status and do not add timing headers to customer-facing responses.

- [ ] **Step 4: Run the focused timing test**

Run: `cd apps/web && node --experimental-strip-types --test src/lib/marketplace-active-timing.test.ts`

Expected: PASS.

### Task 5: Verify the marketplace slice

**Files:**
- Modify only if verification exposes a defect in files from Tasks 1–4.

- [ ] **Step 1: Run POS unit tests**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

- [ ] **Step 2: Run POS TypeScript validation**

Run: `pnpm --filter pappas-order-management exec tsc --noEmit`

Expected: PASS, or report pre-existing failures separately with their exact output.

- [ ] **Step 3: Run web validation**

Run: `pnpm --filter web lint`

Expected: PASS, or report pre-existing failures separately with their exact output.

- [ ] **Step 4: Perform the two-tablet smoke test**

On terminal A leave auto-sync enabled and on terminal B turn it off. Confirm A polls/imports/reconciles; B makes no new `/active` requests or automatic writes; B still receives realtime Live Orders changes; and a manual marketplace refresh/status action on B succeeds. Compare the safe timing events and New Relic responsiveness before and after disabling B.
