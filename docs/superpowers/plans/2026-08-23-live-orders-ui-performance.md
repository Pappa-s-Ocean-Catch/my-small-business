# Live Orders UI Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace grouped, non-virtualized Live Orders rendering and oversized list reads with one responsive chronological queue.

**Architecture:** Add a dedicated source-filtered live-list query that returns only card metadata and uses the shared eligibility helper as a client correctness guard. Render the result with one `FlatList`; memoize rows and isolate elapsed-time updates so the screen does not rerender every second.

**Tech Stack:** Expo/React Native, React Query, Supabase, TypeScript, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-23-pos-marketplace-sync-performance-design.md`

## Global Constraints

- Live Orders is one chronological list; remove all Overdue, Due Soon, Ready, On The Way, Needs Action, and Other section headers.
- Retain existing filter chips, pull-to-refresh, loading/empty/error states, card actions, delivery metadata, status colour, manual printing, and full order detail on demand.
- The dedicated live read must source-filter `pending_online_payment`, completed, cancelled, refunded, and `on_the_way`; keep ASAP orders and scheduled orders through the existing 30-minute cutoff.
- Do not change `getAllOrders` behaviour for history, pre-orders, printing, editing, or modal detail flows.
- The list read must not request `order_item_addons`; the Live list card displays its existing metadata and opens full `getOrder(id)` detail for item-level information.
- Keep realtime invalidation limited to order-list caches; never mutate cart, navigation, modal, or draft state.
- Leave implementation changes uncommitted unless the user explicitly requests a commit.

---

## File Structure

- Modify `apps/pappas-order-management/lib/orders.ts`: add a dedicated projected live-list query and mapper.
- Modify `apps/pappas-order-management/hooks/useLiveOrdersQuery.ts`: use the new read, retain eligibility diagnostics and chronological sort.
- Create `apps/pappas-order-management/test/live-orders-query.test.ts`: mock the query builder and assert source filters/projection/map behaviour.
- Modify `apps/pappas-order-management/components/LiveOrderListItem.tsx`: memoize rows and move elapsed display into a small minute-refresh component.
- Modify `apps/pappas-order-management/app/(drawer)/(tabs)/live-orders.tsx`: delete grouping state/sections/nested scroll views and render one stable `FlatList<Order>`.
- Modify `apps/pappas-order-management/test/live-orders-layout.test.ts`: retain layout-choice coverage and add source assertions for the single virtualized list.

### Task 1: Create the projected live-list data contract

**Files:**
- Create: `apps/pappas-order-management/test/live-orders-query.test.ts`
- Modify: `apps/pappas-order-management/lib/orders.ts`
- Modify: `apps/pappas-order-management/hooks/useLiveOrdersQuery.ts`

**Interfaces:**
- Produces `getLiveOrderList(until: string): Promise<{ data: Order[] | null; error: string | null }>`.
- Consumes `getLiveOrderQueryRange`, `getLiveOrderEligibility`, and `Order`.

- [ ] **Step 1: Write failing query tests**

```ts
test('live-list query selects no item/addon graph and excludes terminal source statuses', async () => {
  await getLiveOrderList('2026-08-23T09:30:00.000Z');
  assert.doesNotMatch(selectExpression, /order_items/);
  assert.deepEqual(excludedStatuses, ['pending_online_payment', 'completed', 'cancelled', 'refunded', 'on_the_way']);
});

test('maps projected rows to Orders with an empty item list', async () => {
  assert.deepEqual(result.data?.[0].items, []);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "live-list query|projected rows"`

Expected: FAIL because `getLiveOrderList` does not exist.

- [ ] **Step 3: Implement the dedicated query**

Define a `LiveOrderListRow` projection containing every non-item `Order` field used by `LiveOrderListItem`, filters, delivery status refresh, print action routing, and order detail selection. Query `orders` with that explicit select list, apply `scheduled_pickup_at.is.null,scheduled_pickup_at.lte.${until}`, exclude the five statuses with `.not('order_status', 'in', '(...)')`, and order by `scheduled_pickup_at` then `created_at`. Map numeric fields with the existing `mapEmbeddedOrder` numeric rules and set `items: []`.

- [ ] **Step 4: Switch Live Orders to the new contract**

In `fetchLiveOrderResult`, replace `getAllOrders({ live_pickup_until: range.until })` with `getLiveOrderList(range.until)`. Retain `getLiveOrderEligibility`, diagnostics, stable chronological sorting, the 30-second refetch interval, and all other hook functions that still correctly use `getAllOrders`.

- [ ] **Step 5: Run focused live-list tests**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "live-list query|projected rows|live order"`

Expected: PASS.

### Task 2: Isolate elapsed-time updates and memoize cards

**Files:**
- Modify: `apps/pappas-order-management/components/LiveOrderListItem.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/live-orders.tsx`

**Interfaces:**
- Produces `LiveOrderElapsedLabel({ createdAt, scheduledPickupAt })` and memoized `LiveOrderListItem` with no `nowMs` prop.
- Consumes existing `formatElapsed` and the unchanged list-card callback interface.

- [ ] **Step 1: Write the failing source-level UI test**

```ts
test('live screen has no one-second whole-screen clock and cards own elapsed labels', () => {
  assert.doesNotMatch(liveScreenSource, /setNowMs\(Date\.now\(\)\)/);
  assert.doesNotMatch(liveScreenSource, /nowMs=\{nowMs\}/);
  assert.match(cardSource, /React\.memo\(/);
  assert.match(cardSource, /LiveOrderElapsedLabel/);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "whole-screen clock"`

Expected: FAIL because `LiveOrdersScreen` owns a one-second `nowMs` interval and cards are not memoized.

- [ ] **Step 3: Implement the isolated label and stable props**

Replace `nowMs` with a `LiveOrderElapsedLabel` component that uses a 60-second aligned timer and calls `formatElapsed(createdAt, Date.now(), scheduledPickupAt)`. Export the card through `React.memo`. In the screen, wrap all callbacks passed to every card in `useCallback`, including print, status alert, payment alert, customer press, quick action, and SmartPay handlers, so list rows receive stable props between query changes.

- [ ] **Step 4: Make the item contract explicit in the card**

When `order.items` is empty from the projected list query, replace the old empty Items preview with `Tap order to view items`; retain the existing preview if a full `Order` is ever supplied. Do not fetch full detail during list render.

- [ ] **Step 5: Run focused UI test**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "whole-screen clock"`

Expected: PASS.

### Task 3: Render one virtualized chronological queue

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/live-orders.tsx`
- Modify: `apps/pappas-order-management/test/live-orders-layout.test.ts`

**Interfaces:**
- Consumes `filteredOrders: Order[]` from the existing chips and memoized `LiveOrderListItem` from Task 2.
- Produces one `FlatList<Order>` using `order.id` as `keyExtractor`.

- [ ] **Step 1: Write the failing structural test**

```ts
test('Live Orders renders one FlatList without grouped sections or nested vertical list scrolling', () => {
  assert.doesNotMatch(source, /type GroupKey/);
  assert.doesNotMatch(source, /groupedSections/);
  assert.doesNotMatch(source, /verticalSection/);
  assert.match(source, /data=\{filteredOrders\}/);
  assert.match(source, /keyExtractor=\{\(order\) => order\.id\}/);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "one FlatList"`

Expected: FAIL because the screen still builds sections and has a vertical `ScrollView` with nested rails.

- [ ] **Step 3: Delete grouping and replace both rendering branches**

Remove `GroupKey`, `ListRow`, `groupedRows`, `groupedSections`, and `nowMs`. Keep `filteredOrders` chronological. Replace both the vertical `ScrollView` branch and horizontal grouped `FlatList` branch with one `FlatList` using `filteredOrders`, one extracted `renderOrder` callback, `keyExtractor`, `refreshControl`, `ListEmptyComponent`, `initialNumToRender={8}`, `maxToRenderPerBatch={8}`, and `windowSize={7}`. Pass the existing `isVerticalCardLayout ? 'vertical' : 'horizontal'` layout prop to rows but never nest a list scroll container.

- [ ] **Step 4: Preserve interaction and status behaviour**

Retain filter chips, `handleRefresh`, selected-order modal, customer modal, print simulation, payment/status alerts, delivery refresh indicators, query diagnostics, and existing `onFocus`/realtime query behaviour. Verify no code path awaits a query invalidation from an order action.

- [ ] **Step 5: Run focused layout tests**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "FlatList|live order cards|whole-screen clock"`

Expected: PASS.

### Task 4: Verify the Live Orders slice

**Files:**
- Modify only if verification exposes a defect in files from Tasks 1–3.

- [ ] **Step 1: Run POS unit tests**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

- [ ] **Step 2: Run POS TypeScript validation**

Run: `pnpm --filter pappas-order-management exec tsc --noEmit`

Expected: PASS, or report pre-existing failures separately with their exact output.

- [ ] **Step 3: Perform a physical tablet smoke test**

Load a peak-sized mix of ASAP and scheduled orders. Confirm one chronological scrollable queue, chip filtering, card actions, pull-to-refresh, full item detail after opening an order, receipt printing, status/payment updates, and delivery status refresh. During an automatic marketplace burst, confirm taps and scrolling stay responsive while React Query refreshes the smaller list in the background.
