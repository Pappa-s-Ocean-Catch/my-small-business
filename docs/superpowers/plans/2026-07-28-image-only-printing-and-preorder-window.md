# Image-Only Printing and Preorder Live-Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all receipt printing image-based and automatically process a preorder when its pickup time enters the 30-minute Live Orders window.

**Architecture:** A pure live-order eligibility helper will be shared by the Live Orders query and the printer automation provider. The provider will run an immediate and 60-second recurring scan of eligible orders, invalidate both relevant query caches, and use its existing claim-protected image-print workflow. Legacy text and HTML receipt transports will be removed, leaving image capture and the existing image queue as the only receipt path.

**Tech Stack:** Expo/React Native, TypeScript, TanStack Query, Zustand, Node test runner.

## Global Constraints

- Receipt output must use `ReceiptTemplate` or `CustomerReceiptTemplate` image capture and `escposPrintOrderImage` only.
- The live window is `scheduled_pickup_at <= now + 30 minutes`; non-scheduled active orders are already live.
- Preserve the existing database kitchen-print claim as the multi-device exactly-once guard.
- The recurring scan runs immediately when the provider mounts and every 60 seconds while mounted.
- Do not alter printer routing, print-claim database schema, receipt layout, or simulator semantics.

---

### Task 1: Extract and test shared live-order eligibility

**Files:**
- Create: `apps/pappas-order-management/lib/live-order-window.ts`
- Create: `apps/pappas-order-management/test/live-order-window.test.ts`
- Modify: `apps/pappas-order-management/hooks/useLiveOrdersQuery.ts:1-52`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**
- Produces `isLiveOrder(order: Pick<Order, 'scheduled_pickup_at' | 'order_status' | 'payment_status'>, nowMs?: number): boolean`.
- Produces `getAutoPrintableLiveOrders(orders: Order[], nowMs?: number): Order[]`, returning only pending or confirmed orders in the live window and excluding refunded orders.
- `fetchLiveOrders()` consumes `isLiveOrder` so screen visibility and automation share the same boundary.

- [ ] **Step 1: Write failing eligibility tests**

```ts
test('includes a preorder exactly 30 minutes before pickup', () => {
  const nowMs = Date.parse('2026-07-28T10:00:00.000Z');
  const order = makeOrder({ scheduled_pickup_at: '2026-07-28T10:30:00.000Z' });
  assert.equal(isLiveOrder(order, nowMs), true);
});

test('excludes a preorder more than 30 minutes before pickup', () => {
  const nowMs = Date.parse('2026-07-28T10:00:00.000Z');
  const order = makeOrder({ scheduled_pickup_at: '2026-07-28T10:30:00.001Z' });
  assert.equal(isLiveOrder(order, nowMs), false);
});

test('selects only pending or confirmed live orders for auto-print', () => {
  assert.deepEqual(
    getAutoPrintableLiveOrders([
      makeOrder({ id: 'pending', order_status: 'pending' }),
      makeOrder({ id: 'confirmed', order_status: 'confirmed' }),
      makeOrder({ id: 'preparing', order_status: 'preparing' }),
      makeOrder({ id: 'future', scheduled_pickup_at: '2026-07-28T11:00:00.000Z' }),
    ], Date.parse('2026-07-28T10:00:00.000Z')).map((order) => order.id),
    ['pending', 'confirmed'],
  );
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: TypeScript compilation fails because `live-order-window.ts` and its exports do not exist.

- [ ] **Step 3: Implement the minimal pure helper**

```ts
export function isLiveOrder(order: LiveOrderCandidate, nowMs = Date.now()): boolean {
  if (isClosedOrRefunded(order)) return false;
  const leadMinutes = getScheduledPickupLeadMinutes(order.scheduled_pickup_at, nowMs);
  return leadMinutes == null || leadMinutes <= PRE_ORDER_LEAD_MINUTES;
}

export function getAutoPrintableLiveOrders(orders: Order[], nowMs = Date.now()): Order[] {
  return orders.filter((order) => (
    isLiveOrder(order, nowMs)
    && (order.order_status === 'pending' || order.order_status === 'confirmed')
    && order.payment_status !== 'refunded'
  ));
}
```

Update `fetchLiveOrders` to import and use the helper. Include the new helper in `tsconfig.test.json`.

- [ ] **Step 4: Run the focused unit suite to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS, including the three new live-window tests.

- [ ] **Step 5: Commit**

```bash
git add apps/pappas-order-management/lib/live-order-window.ts apps/pappas-order-management/test/live-order-window.test.ts apps/pappas-order-management/hooks/useLiveOrdersQuery.ts apps/pappas-order-management/tsconfig.test.json
git commit -m "feat: share preorder live-window eligibility"
```

### Task 2: Add claim-protected preorder window automation

**Files:**
- Modify: `apps/pappas-order-management/providers/PrinterAutomationProvider.tsx:1-620`

**Interfaces:**
- Consumes `fetchLiveOrders` and `getAutoPrintableLiveOrders` from the shared live-order boundary.
- Consumes the existing `fetchAndAnnounceOrder(orderId)` and `quickPrintAutoOrder(order)` image workflow.
- Produces a mount-time plus 60-second provider timer that invalidates Live Orders and Pre-orders queries and calls `fetchAndAnnounceOrder` for newly eligible orders.

- [ ] **Step 1: Add a failing provider-facing unit seam**

Extract a pure selector call for the provider scan and add a test proving that a future preorder is not scheduled while the same order at the 30-minute boundary is scheduled. Keep React effects unmocked; test `getAutoPrintableLiveOrders` from Task 1 as the provider’s eligibility seam.

- [ ] **Step 2: Run the unit suite to verify the new provider eligibility case fails**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL because the new boundary test is absent or the selector does not yet represent the provider scan contract.

- [ ] **Step 3: Implement the provider scan**

```ts
const scanLiveOrdersForAutoPrint = useCallback(async () => {
  try {
    const liveOrders = await fetchLiveOrders();
    void queryClient.invalidateQueries({ queryKey: LIVE_ORDERS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: PRE_ORDERS_QUERY_KEY });
    for (const order of getAutoPrintableLiveOrders(liveOrders)) {
      scheduleOrderAnnouncement(order);
    }
  } catch (error) {
    console.error('Failed to scan preorders entering the live window:', error);
  }
}, [queryClient, scheduleOrderAnnouncement]);

useEffect(() => {
  void scanLiveOrdersForAutoPrint();
  const intervalId = setInterval(() => void scanLiveOrdersForAutoPrint(), 60 * 1000);
  return () => clearInterval(intervalId);
}, [scanLiveOrdersForAutoPrint]);
```

Use the actual provider dependency ordering: define the callback after `scheduleOrderAnnouncement`, and preserve the existing realtime handling. The scan must not directly call any printer API; it must enter `fetchAndAnnounceOrder`/`quickPrintAutoOrder`, which captures receipt images and obtains the print claim.

- [ ] **Step 4: Run the unit suite to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS. Confirm the provider only uses the existing image queue for receipt delivery.

- [ ] **Step 5: Commit**

```bash
git add apps/pappas-order-management/providers/PrinterAutomationProvider.tsx apps/pappas-order-management/test/live-order-window.test.ts
git commit -m "feat: auto-print preorders in live window"
```

### Task 3: Remove legacy non-image receipt transports and fallbacks

**Files:**
- Modify: `apps/pappas-order-management/lib/escpos-printer.ts:1-715`
- Delete: `apps/pappas-order-management/lib/epson-epos.ts`
- Modify: `apps/pappas-order-management/hooks/useOrderActions.ts:1-430`
- Modify: `apps/pappas-order-management/app/order-detail.tsx:1-390`
- Delete: `apps/pappas-order-management/app/(tabs)/orders.tsx`
- Modify: `apps/pappas-order-management/utils/orderUtils.ts:411-500`
- Modify: `apps/pappas-order-management/test/orderUtils.test.ts`

**Interfaces:**
- Removes `escposPrintKitchenReceipt`, `buildRawKitchenReceiptBytes`, `printReceiptLine`, `epsonPrintKitchenReceipt`, `generatePrintHTML`, and `expo-print` receipt calls.
- Preserves `escposPrintOrderImage`, `captureReceiptForPrinter`, and `enqueuePreparedPrintJobs` as the sole receipt print interfaces.
- `OrderDetailModal` continues to use `onPrintImage`, which it already prefers when available.

- [ ] **Step 1: Write failing static transport tests**

Add a Node test that reads the receipt transport source files and asserts that receipt code contains `escposPrintOrderImage` but does not contain `escposPrintKitchenReceipt`, `Print.printAsync`, or `generatePrintHTML`.

```ts
assert.match(escposPrinterSource, /export async function escposPrintOrderImage/);
assert.doesNotMatch(escposPrinterSource, /escposPrintKitchenReceipt/);
assert.doesNotMatch(orderActionSource, /Print\.printAsync|generatePrintHTML/);
```

- [ ] **Step 2: Run the unit suite to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL because legacy functions and fallbacks still exist.

- [ ] **Step 3: Delete legacy paths and make image printing required**

- Remove the legacy text receipt builder/imports and `escposPrintKitchenReceipt` from `escpos-printer.ts`; retain `escposTestPrint` only if printer setup still needs a non-receipt diagnostic.
- Delete unused `epson-epos.ts` after removing its only remaining import.
- Remove `expo-print`, `generatePrintHTML`, and all text-receipt calls from `useOrderActions.ts` and `order-detail.tsx`. When image printing cannot proceed, return `false` and surface the existing image-print error state instead of opening a system-print dialog.
- Delete the unmounted legacy `app/(tabs)/orders.tsx` route, which is the only direct legacy caller, after confirming no route imports it.
- Remove `generatePrintHTML` and its test if no remaining code imports it.
- Run `rg` to confirm no production caller or import of legacy receipt transport remains.

- [ ] **Step 4: Run full verification**

Run: `pnpm --filter pappas-order-management test:unit && pnpm --filter pappas-order-management exec tsc --noEmit`

Expected: PASS with no `escposPrintKitchenReceipt`, `epsonPrintKitchenReceipt`, `Print.printAsync`, or `generatePrintHTML` references in production code.

- [ ] **Step 5: Commit**

```bash
git add -A apps/pappas-order-management
git commit -m "refactor: enforce image-only receipt printing"
```

### Task 4: Final audit

**Files:**
- Verify only; no planned source changes.

- [ ] **Step 1: Audit receipt transport references**

Run:

```bash
rg -n 'escposPrintKitchenReceipt|epsonPrintKitchenReceipt|Print\.printAsync|generatePrintHTML' apps/pappas-order-management
```

Expected: no matches in production receipt code.

- [ ] **Step 2: Run final automated verification**

Run: `pnpm --filter pappas-order-management test:unit && pnpm --filter pappas-order-management exec tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Commit any audit-only corrections if needed**

```bash
git add <corrected-files>
git commit -m "test: verify image-only preorder printing"
```
