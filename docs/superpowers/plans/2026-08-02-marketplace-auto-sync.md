# Marketplace Auto-Sync to POS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poll active marketplace orders every 30 seconds while POS is open, create missing POS orders once, and synchronize only their status.

**Architecture:** Extract the full manual marketplace-import construction into a reusable service, then call it from both manual POS import and a root-mounted foreground sync provider. A shared lifecycle mapper derives `on_the_way` from provider state, description, and timeline; existing imported orders receive status-only updates.

**Tech Stack:** Expo/React Native, TypeScript, Supabase, Node test runner.

## Global Constraints

- Poll only while the authenticated POS app is open; interval is exactly 30 seconds.
- New automatic orders follow the manual importer and existing printer automation.
- Existing marketplace orders update only `order_status`.
- Add POS status `on_the_way`; map picked-up/en-route states to it.
- Status mapping must use normalized provider state, description, and timeline.
- No background server job or automatic marketplace acknowledgement is added.

---

### Task 1: Extend lifecycle/status support

**Files:**
- Modify: `libs/types/order.ts`
- Modify: `supabase/migrations/<new>_add_on_the_way_order_status.sql`
- Modify: `apps/pappas-order-management/lib/marketplace-pos-import.ts`
- Modify: `apps/pappas-order-management/test/marketplace-pos-import.test.ts`
- Modify: `apps/pappas-order-management/utils/constants.ts`

**Interfaces:**
- Produces: `getMarketplaceOrderStatus(state, description, timeline?)` returning `on_the_way` for picked-up/en-route states.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
assert.equal(getMarketplaceOrderStatus('PICKED_UP', null), 'on_the_way');
assert.equal(getMarketplaceOrderStatus(null, 'Driver is on the way'), 'on_the_way');
assert.equal(getMarketplaceOrderStatus(null, null, [{ changedAt: 1, orderState: 'PICKED_UP' }]), 'on_the_way');
assert.equal(getMarketplaceOrderStatus(null, null, [{ changedAt: 1, orderState: 'DELIVERED' }]), 'completed');
```

- [ ] **Step 2: Run unit tests and confirm RED**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL because `on_the_way` is not a supported POS status.

- [ ] **Step 3: Implement type, migration, status labels, and normalized mapper**

Update the order constraint and all exhaustive order-status maps. Let terminal cancelled/refunded states override delivery states; let delivered/completed override picked-up/en-route; map `picked up`, `en route`, `on the way`, and `out for delivery` to `on_the_way`.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter pappas-order-management test:unit && git diff --check`

Expected: PASS.

### Task 2: Extract reusable marketplace import service

**Files:**
- Create: `apps/pappas-order-management/lib/marketplace-pos-order.ts`
- Modify: `apps/pappas-order-management/app/pos.tsx`
- Modify: `apps/pappas-order-management/lib/orders.ts`
- Modify: `apps/pappas-order-management/test/marketplace-pos-order.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**
- Produces: `importMarketplaceOrder(detail): Promise<{ order: Order | null; created: boolean; error: string | null }>`.
- Produces: `syncMarketplaceOrderStatus(provider, externalOrderId, detail): Promise<{ order: Order | null; error: string | null }>`.

- [ ] **Step 1: Write failing service tests**

Test that a new detail creates through `savePosOrder` exactly once and that a pre-existing provider/ID row receives only an `order_status` update. Assert the update payload has no items, total, snapshot, customer, or notes fields.

- [ ] **Step 2: Run unit tests and confirm RED**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Extract implementation**

Move manual draft conversion into the service without changing matching/removal rules. New import uses the saved financial snapshot and initial lifecycle status. Existing import queries on normalized provider/trimmed ID and calls a narrow status-only update. Keep the database unique error as idempotency protection.

- [ ] **Step 4: Make manual POS import use the service and verify**

Run: `pnpm --filter pappas-order-management test:unit && pnpm --filter pappas-order-management exec tsc -p tsconfig.json --noEmit`

Expected: unit tests pass; record the existing minimatch/baseline TypeScript failure if it remains.

### Task 3: Add root foreground marketplace sync

**Files:**
- Create: `apps/pappas-order-management/providers/MarketplaceSyncProvider.tsx`
- Modify: `apps/pappas-order-management/app/_layout.tsx`
- Modify: `apps/pappas-order-management/lib/marketplace.ts`
- Modify: `apps/pappas-order-management/test/marketplace-sync.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**
- Produces: a root provider that executes immediately after authentication and every 30,000 ms while mounted.
- Consumes: active-order APIs, detail API, and Task 2 service.

- [ ] **Step 1: Write failing polling tests**

Verify an immediate poll plus a 30-second interval, no overlapping runs, both providers processed independently, and one order failure does not prevent other orders.

- [ ] **Step 2: Run unit tests and confirm RED**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL because sync coordinator/provider is absent.

- [ ] **Step 3: Implement sync coordinator/provider**

Fetch active lists for both providers concurrently, fetch each detail with `mode: 'live'`, and call the service. Guard with an in-flight ref; clear the interval on unmount; log failures without showing repeated blocking alerts.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter pappas-order-management test:unit && git diff --check`

Expected: PASS.

### Task 4: Render real On the way orders

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/on-the-way.tsx`
- Modify: `apps/pappas-order-management/hooks/useLiveOrdersQuery.ts`
- Modify: `apps/pappas-order-management/test/live-order-window.test.ts`

- [ ] **Step 1: Write a failing query/filter test**

Assert an `on_the_way` order is included in the delivery view and terminal completed/cancelled/refunded orders are excluded.

- [ ] **Step 2: Run unit tests and confirm RED**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL until the tab/query renders actual orders.

- [ ] **Step 3: Implement the tab**

Replace the placeholder with the existing order-list presentation filtered to `on_the_way`; preserve refresh/loading/error conventions. Do not expose terminal orders.

- [ ] **Step 4: Final verification and commit**

Run: `pnpm --filter pappas-order-management test:unit && pnpm --filter pappas-order-management exec tsc -p tsconfig.json --noEmit && git diff --check`

Expected: unit tests and diff check pass; record any pre-existing type-check blocker.

