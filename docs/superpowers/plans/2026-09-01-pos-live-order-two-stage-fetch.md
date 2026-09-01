# POS Live Order Two-Stage Fetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop recurring Live Orders and preorder paths from downloading full historical order details before eligibility is known.

**Architecture:** Introduce a lightweight 14-day open-order candidate query and an explicit full-detail hydration query. Existing live/preorder eligibility remains local and unchanged; full `Order` data is retrieved only for selected IDs.

**Tech Stack:** Expo React Native, TypeScript, Supabase JS, TanStack Query, Node test runner, PostgreSQL migrations.

**Spec:** `docs/superpowers/specs/2026-09-01-pos-live-order-two-stage-fetch-design.md`

## Global Constraints

- Candidate window is `created_at >= now - 14 days`.
- Exclude `completed`, `cancelled`, `refunded`, and `pending_online_payment` candidates, plus candidates whose `payment_status` is `refunded`.
- Do not alter `getLiveOrderEligibility`, the 30-minute live pickup rule, on-the-way exclusion, or printer auto-print status rules.
- Full order hydration must retain `order_items` and `order_item_addons` exactly as current cards, modals, printing, and delivery flows expect.
- No marketplace history reconciliation change is included.
- Do not log customer/order payloads, cookies, tokens, or headers.

---

### Task 1: Define and test lightweight candidate selection

**Files:**
- Modify: `apps/pappas-order-management/lib/orders.ts:13-15,157-235`
- Modify: `apps/pappas-order-management/lib/live-order-window.ts:1-75`
- Modify: `apps/pappas-order-management/test/live-order-window.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**
- Produces `OpenOrderCandidate`, containing `id`, `created_at`, `scheduled_pickup_at`, `order_status`, and `payment_status`.
- Produces `getOpenOrderCandidateRange(nowMs): { since: string }`, where `since` is exactly 14 days before `nowMs`.
- Produces `getOpenOrderCandidates(nowMs): Promise<{ data: OpenOrderCandidate[] | null; error: string | null }>`.

- [ ] **Step 1: Write failing boundary tests**

```ts
test('builds the open order candidate range for the preceding 14 days', () => {
  assert.deepEqual(getOpenOrderCandidateRange(nowMs), {
    since: '2026-07-14T10:00:00.000Z',
  });
});
```

- [ ] **Step 2: Run the focused emitted test and confirm it fails**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: test compilation fails because `getOpenOrderCandidateRange` does not exist. If baseline printer compilation fails first, run a direct emitted test using a temporary test config that includes only `live-order-window.ts` and this test, and record the baseline failure separately.

- [ ] **Step 3: Implement the candidate type and range**

```ts
export type OpenOrderCandidate = Pick<Order,
  'id' | 'created_at' | 'scheduled_pickup_at' | 'order_status' | 'payment_status'
>;

export function getOpenOrderCandidateRange(nowMs = Date.now()) {
  return { since: new Date(nowMs - 14 * 24 * 60 * 60 * 1000).toISOString() };
}
```

Implement `getOpenOrderCandidates` with a narrow select and `.gte('created_at', since)`, excluding `completed`, `cancelled`, `refunded`, and `pending_online_payment` statuses plus `refunded` payment status. Do not use `getAllOrders` or embed order items.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: direct emitted test command from Step 2.

Expected: boundary test passes with no change to existing live eligibility tests.

### Task 2: Add full-detail hydration by selected IDs

**Files:**
- Modify: `apps/pappas-order-management/lib/orders.ts:157-235`
- Create: `apps/pappas-order-management/test/order-hydration.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**
- Produces `getOrdersByIds(ids: string[]): Promise<{ data: Order[] | null; error: string | null }>`.
- Empty input returns `{ data: [], error: null }` without creating a Supabase query.

- [ ] **Step 1: Write failing pure selection tests**

```ts
test('does not request details when no IDs are eligible', async () => {
  const result = await getOrdersByIds([]);
  assert.deepEqual(result, { data: [], error: null });
});
```

Extract the empty-ID branch to a testable helper if the Supabase client cannot be mocked within the current Node test setup.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: direct emitted test command including `order-hydration.test.ts`.

Expected: compilation fails because `getOrdersByIds` does not exist.

- [ ] **Step 3: Implement ID hydration**

```ts
export async function getOrdersByIds(ids: string[]) {
  if (ids.length === 0) return { data: [], error: null };
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, order_item_addons(*))')
    .in('id', ids);
  // map with mapEmbeddedOrder and retain the existing error contract
}
```

Deduplicate IDs before `.in`, and return rows in the caller's required ordering rather than relying on database order.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: direct emitted test command including `order-hydration.test.ts`.

Expected: empty IDs return without detail access.

### Task 3: Convert Live Orders and preorder count to two stages

**Files:**
- Modify: `apps/pappas-order-management/hooks/useLiveOrdersQuery.ts:1-173`
- Create: `apps/pappas-order-management/test/live-orders-query-selection.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**
- `fetchLiveOrders(nowMs?)` returns the same full `Order[]` contract.
- `fetchPreOrderCount(nowMs?)` uses candidates only and returns `number`.

- [ ] **Step 1: Write failing selection tests**

```ts
test('hydrates only IDs that pass existing Live Order eligibility', () => {
  const ids = selectLiveOrderIds([
    candidate({ id: 'asap', scheduled_pickup_at: null }),
    candidate({ id: 'future', scheduled_pickup_at: '2026-07-28T12:00:00.000Z' }),
    candidate({ id: 'done', order_status: 'completed' }),
  ], nowMs);
  assert.deepEqual(ids, ['asap']);
});

test('counts future preorders from candidates without hydration', () => {
  assert.equal(selectPreOrderCount([candidate({ id: 'future', scheduled_pickup_at: '2026-07-28T12:00:00.000Z' })], nowMs), 1);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: direct emitted test command including `live-orders-query-selection.test.ts`.

Expected: compilation fails because `selectLiveOrderIds` and `selectPreOrderCount` do not exist.

- [ ] **Step 3: Implement the two-stage functions**

Use `getOpenOrderCandidates(nowMs)`, `getLiveOrderEligibility`, and `getOrdersByIds`. Hydrate only selected live IDs. Sort hydrated orders with the existing `sortLiveOrders`. Keep `fetchLiveOrderDiagnostics` candidate-based and include candidate/eligible/hydrated counts without order contents beyond the current bounded diagnostic rows.

- [ ] **Step 4: Run focused tests and existing live window tests**

Run: direct emitted test command including `live-orders-query-selection.test.ts` and `live-order-window.test.ts`.

Expected: all pass; the 30-minute pickup boundary remains unchanged.

### Task 4: Preserve preorder screen and printer scheduling behavior

**Files:**
- Modify: `apps/pappas-order-management/hooks/useLiveOrdersQuery.ts:114-143`
- Modify: `apps/pappas-order-management/providers/PrinterAutomationProvider.tsx:691-723`
- Create: `apps/pappas-order-management/test/preorder-query-selection.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**
- `fetchPreOrders(nowMs?)` hydrates only 14-day candidate IDs that satisfy `isScheduledPreOrder`.
- `fetchScheduledOrdersInAutomationWindow(nowMs?)` identifies scheduled candidates inside its existing seven-day-back-to-30-minute-ahead range before hydrating printable orders.

- [ ] **Step 1: Write failing regression tests**

```ts
test('keeps a preorder in the 14-day candidate window', () => {
  assert.deepEqual(selectPreOrderIds([
    candidate({ id: 'preorder', scheduled_pickup_at: '2026-08-01T10:00:00.000Z' }),
  ], nowMs), ['preorder']);
});

test('does not hydrate a future preorder for printer automation', () => {
  assert.deepEqual(selectScheduledAutomationIds([
    candidate({ id: 'future', scheduled_pickup_at: '2026-07-28T12:00:00.000Z' }),
  ], nowMs), []);
});
```

- [ ] **Step 2: Run focused preorder tests and confirm they fail**

Run: direct emitted test command including `preorder-query-selection.test.ts`.

Expected: compilation fails because the selection helpers do not exist.

- [ ] **Step 3: Implement bounded preorder and automation hydration**

Reuse candidates and ID hydration; do not change existing `isScheduledPreOrder`, `getScheduledOrderAutomationRange`, `getAutoPrintableLiveOrders`, or the one-minute scheduler cadence. Invalidate the same query keys after the scheduler run.

- [ ] **Step 4: Run focused preorder and auto-print tests**

Run: direct emitted test command including `preorder-query-selection.test.ts` and `live-order-window.test.ts`.

Expected: all pass, including the existing one-week scheduled automation range assertion.

### Task 5: Add query-aligned database index and safe timing metrics

**Files:**
- Create: `supabase/migrations/20260901120000_add_open_order_candidate_index.sql`
- Modify: `apps/pappas-order-management/hooks/useLiveOrdersQuery.ts`
- Create: `docs/pos-live-order-performance-validation.md`

**Interfaces:**
- Migration creates `idx_orders_open_candidate_created_at` for non-terminal, non-`pending_online_payment` order candidates ordered by `created_at DESC`.
- Performance log fields are `candidateDurationMs`, `hydrationDurationMs`, `candidateCount`, `eligibleCount`, and `hydratedCount` only.

- [ ] **Step 1: Write the migration verification query in the validation document**

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, created_at, scheduled_pickup_at, order_status, payment_status
FROM public.orders
WHERE created_at >= now() - interval '14 days'
  AND order_status NOT IN ('completed', 'cancelled', 'refunded', 'pending_online_payment')
  AND payment_status <> 'refunded'
ORDER BY created_at DESC;
```

- [ ] **Step 2: Add the partial index migration**

```sql
CREATE INDEX IF NOT EXISTS idx_orders_open_candidate_created_at
ON public.orders (created_at DESC)
WHERE order_status NOT IN ('completed', 'cancelled', 'refunded', 'pending_online_payment')
  AND payment_status <> 'refunded';
```

- [ ] **Step 3: Add redacted timing metrics around candidate and hydration calls**

Do not log IDs, order numbers, payloads, customer fields, credentials, or headers. Metrics remain temporary until a busy-period device capture is reviewed.

- [ ] **Step 4: Validate before rollout**

Run: focused emitted tests from Tasks 1-4, `git diff --check`, then execute the `EXPLAIN ANALYZE` query in a production-like Supabase environment.

Expected: focused tests pass, diff has no whitespace errors, and the database plan uses the partial index or gives concrete evidence for an index adjustment.

### Task 6: Device validation and staged rollout

**Files:**
- Modify: `docs/pos-live-order-performance-validation.md`

- [ ] **Step 1: Capture a 5-6 pm tablet baseline before enabling the patch**

Record candidate count, eligible count, hydration count, candidate duration, hydration duration, marketplace interval, and UI responsiveness. Redact all order/customer data.

- [ ] **Step 2: Validate core workflows on a rebuilt/OTA-updated device as applicable**

Check: Live Orders list and filter; a preorder more than 30 minutes out; a preorder entering the 30-minute window; preorder count; printer scheduler; order details; customer modal; delivery status refresh; on-the-way order removal.

- [ ] **Step 3: Compare after-patch metrics at the same time window**

Success is materially lower hydrated count/payload and no regression in preorder visibility, printing, or status transitions. If candidate-query latency remains high, use the recorded `EXPLAIN ANALYZE` plan before changing query/index design.
