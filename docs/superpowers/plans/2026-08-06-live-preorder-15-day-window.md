# Live Preorder 15-Day Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show and auto-print scheduled preorders that enter the 30-minute live window even when created up to 15 days earlier.

**Architecture:** Export the scheduled-order lookback from the shared live-window helper. Fetch the existing 24-hour live set and the 15-day scheduled pickup set in parallel, merge by order ID, and then apply the existing live predicate and sort. This preserves the 24-hour cap for unscheduled orders while aligning visible scheduled orders with automation.

**Tech Stack:** TypeScript, Expo/React Native, Supabase client queries, Node test runner.

## Global Constraints

- Keep ordinary unscheduled Live Orders limited to the existing 24-hour `created_at` query.
- Use a 15-day scheduled pickup lookback for both Live Orders and auto-print automation.
- Keep the existing 30-minute pickup boundary and print/status behavior unchanged.
- Do not change printer routing, receipt rendering, claims, or database schema.

---

### Task 1: Share the scheduled pickup window and cover its boundary

**Files:**

- Modify: `apps/pappas-order-management/lib/live-order-window.ts:5-36`
- Modify: `apps/pappas-order-management/test/live-order-window.test.ts:1-55`

**Interfaces:**

- Produces: `PREORDER_AUTOMATION_LOOKBACK_MS: number`, equal to `15 * 24 * 60 * 60 * 1000`.
- Produces: `getScheduledOrderAutomationRange(nowMs)` returning `{ from: string; until: string }` using the shared 15-day constant.

- [ ] **Step 1: Write the failing test**

```ts
test('uses a 15-day scheduled pickup window for preorder automation', () => {
  assert.deepEqual(getScheduledOrderAutomationRange(nowMs), {
    from: '2026-07-13T10:00:00.000Z',
    until: '2026-07-28T10:30:00.000Z',
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="15-day scheduled pickup"`

Expected: the range assertion fails because the implementation still starts seven days before `now`.

- [ ] **Step 3: Write the minimal implementation**

```ts
export const PREORDER_AUTOMATION_LOOKBACK_MS = 15 * 24 * 60 * 60 * 1000;

export function getScheduledOrderAutomationRange(nowMs: number = Date.now()) {
  return {
    from: new Date(nowMs - PREORDER_AUTOMATION_LOOKBACK_MS).toISOString(),
    until: new Date(nowMs + PRE_ORDER_LEAD_MINUTES * 60 * 1000).toISOString(),
  };
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="15-day scheduled pickup"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pappas-order-management/lib/live-order-window.ts apps/pappas-order-management/test/live-order-window.test.ts
git commit -m "fix: use 15-day preorder automation window"
```

### Task 2: Include currently-live scheduled orders in Live Orders

**Files:**

- Modify: `apps/pappas-order-management/hooks/useLiveOrdersQuery.ts:1-45`
- Modify: `apps/pappas-order-management/test/live-order-window.test.ts:1-55`

**Interfaces:**

- Consumes: `getScheduledOrderAutomationRange(nowMs)` from `lib/live-order-window.ts`.
- Produces: `fetchLiveOrders(nowMs?: number): Promise<Order[]>`, combining 24-hour creation-time orders and scheduled orders in the shared 15-day pickup window, deduplicated by `id` and filtered with `isLiveOrder(order, nowMs)`.

- [ ] **Step 1: Write the failing test**

```ts
test('includes a week-old order whose scheduled pickup is at the live boundary', () => {
  const nowMs = Date.parse('2026-07-28T10:00:00.000Z');
  const scheduledOrder = makeOrder({
    id: 'week-old-scheduled',
    created_at: '2026-07-21T09:00:00.000Z',
    scheduled_pickup_at: '2026-07-28T10:30:00.000Z',
  });
  assert.deepEqual(mergeLiveOrderResults([], [scheduledOrder], nowMs).map((order) => order.id), ['week-old-scheduled']);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="week-old order"`

Expected: TypeScript compilation fails because `mergeLiveOrderResults` has not been exported.

- [ ] **Step 3: Write the minimal implementation**

```ts
export function mergeLiveOrderResults(recentlyCreatedOrders: Order[], scheduledOrders: Order[], nowMs: number = Date.now()): Order[] {
  const byId = new Map([...recentlyCreatedOrders, ...scheduledOrders].map((order) => [order.id, order]));
  return sortLiveOrders([...byId.values()].filter((order) => isLiveOrder(order, nowMs)));
}
```

Update `fetchLiveOrders` to query the 24-hour creation-time range and the shared scheduled pickup range in parallel, throw either query error, then return `mergeLiveOrderResults(recent.data || [], scheduled.data || [], nowMs)`.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern="week-old order"`

Expected: PASS.

- [ ] **Step 5: Run the full order-management unit suite**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: TypeScript compilation succeeds and all Node tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/pappas-order-management/hooks/useLiveOrdersQuery.ts apps/pappas-order-management/test/live-order-window.test.ts
git commit -m "fix: show live preorders created within 15 days"
```
