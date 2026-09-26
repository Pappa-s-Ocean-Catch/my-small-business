# Desktop POS Live Orders and Printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an operational desktop Live Orders queue with order detail and status actions, followed by a safe desktop print handoff.

**Architecture:** Keep desktop order data in a dedicated gateway and Live Orders store, isolated from the new-order cart. The renderer receives typed order snapshots, refreshes them on `order_sync_state` changes, and sends all mutations through the gateway. Printing is an explicit action on an authoritative detail snapshot; platform transport remains behind a desktop print service.

**Tech Stack:** Tauri 2, React 19, TypeScript, Vitest, Supabase JS, existing Supabase `orders` / `order_sync_state` contracts.

**Spec:** `docs/superpowers/specs/2026-09-24-pos-desktop-live-orders-design.md`

## Global Constraints

- Do not modify the Expo POS.
- Work on `main` and leave changes uncommitted.
- Query the existing Supabase order contracts as an authenticated staff user; do not add browser-stored credentials.
- A Live Order excludes completed, cancelled, refunded, on-the-way, and pending online-payment orders; scheduled pickups are eligible only through the existing 30-minute pickup window.
- Realtime must never mutate the new-order cart.
- A failed print must not clear, recreate, or retry a persisted order.

## Review Focus

- A pickup scheduled 31 minutes away is absent while an otherwise identical 30-minute pickup is present; covered in Task 1 eligibility tests.
- A stale refresh response after sign-out cannot repopulate the queue; covered in Task 2 store tests.
- A second status click for the same order is rejected while the first is pending; covered in Task 3 action-service tests.
- A realtime notification refreshes the queue but does not modify the cart; covered in Task 4 renderer/store integration test.
- A printer transport failure leaves the saved order and its detail view intact; covered in Task 6 print-service test.

---

### Task 1: Define desktop order and Live Orders eligibility contracts

**Files:**
- Create: `apps/pappas-order-management-desktop/src/features/orders/order-types.ts`
- Create: `apps/pappas-order-management-desktop/src/features/orders/live-order-eligibility.ts`
- Create: `apps/pappas-order-management-desktop/src/features/orders/live-order-eligibility.test.ts`

**Interfaces:**
- Produces `DesktopOrder`, `DesktopOrderItem`, `isDesktopLiveOrder(order, nowMs)`, and `sortDesktopLiveOrders(orders)`.
- Consumes only plain order fields returned by the Supabase gateway.

- [ ] **Step 1: Write failing eligibility tests**

```ts
it('includes an order due in 30 minutes but excludes one due in 31 minutes', () => {
  expect(isDesktopLiveOrder(order({ scheduled_pickup_at: isoAt(30) }), now)).toBe(true);
  expect(isDesktopLiveOrder(order({ scheduled_pickup_at: isoAt(31) }), now)).toBe(false);
});

it('excludes completed, cancelled, refunded, on-the-way, and pending online payment orders', () => {
  for (const candidate of excludedOrders()) expect(isDesktopLiveOrder(candidate, now)).toBe(false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir apps/pappas-order-management-desktop test -- --run src/features/orders/live-order-eligibility.test.ts`

Expected: FAIL because the eligibility module does not exist.

- [ ] **Step 3: Implement the typed eligibility boundary**

```ts
export function isDesktopLiveOrder(order: DesktopOrder, nowMs = Date.now()): boolean {
  if (['completed', 'cancelled', 'on_the_way'].includes(order.order_status)) return false;
  if (order.payment_status === 'refunded' || order.order_status === 'pending_online_payment') return false;
  return !order.scheduled_pickup_at || new Date(order.scheduled_pickup_at).getTime() <= nowMs + 30 * 60_000;
}

export function sortDesktopLiveOrders(orders: DesktopOrder[]) {
  return [...orders].sort((left, right) => new Date(left.scheduled_pickup_at ?? left.created_at).getTime() - new Date(right.scheduled_pickup_at ?? right.created_at).getTime());
}
```

- [ ] **Step 4: Run focused tests**

Run: `pnpm --dir apps/pappas-order-management-desktop test -- --run src/features/orders/live-order-eligibility.test.ts`

Expected: PASS.

- [ ] **Step 5: Record task completion without committing**

Run: `git diff --check -- apps/pappas-order-management-desktop/src/features/orders`

Expected: no output.

### Task 2: Build the Supabase order gateway and race-safe Live Orders store

**Files:**
- Create: `apps/pappas-order-management-desktop/src/features/orders/desktop-order-gateway.ts`
- Create: `apps/pappas-order-management-desktop/src/features/orders/live-orders-store.ts`
- Create: `apps/pappas-order-management-desktop/src/features/orders/live-orders-store.test.ts`

**Interfaces:**
- Consumes `SupabaseClient`, `DesktopOrder`, and `isDesktopLiveOrder` from Task 1.
- Produces `createDesktopOrderGateway(client)`, `createLiveOrdersStore({ load })`, and `LiveOrdersState` with `refresh(reason)` / `reset()`.

- [ ] **Step 1: Write failing race and stale-data tests**

```ts
it('does not publish a request that completes after reset', async () => {
  const pending = deferred<DesktopOrder[]>();
  const store = createLiveOrdersStore({ load: () => pending.promise });
  const request = store.refresh('startup'); store.reset(); pending.resolve([order()]);
  await request; expect(store.getState().orders).toEqual([]);
});

it('retains visible orders after a realtime refresh failure', async () => {
  const store = storeWithFirstSuccessThenFailure();
  await store.refresh('startup'); await expect(store.refresh('realtime')).rejects.toThrow('offline');
  expect(store.getState()).toMatchObject({ status: 'ready', orders: [expect.any(Object)], error: 'offline' });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir apps/pappas-order-management-desktop test -- --run src/features/orders/live-orders-store.test.ts`

Expected: FAIL because the gateway/store modules do not exist.

- [ ] **Step 3: Implement candidate query, hydration, and store generations**

```ts
async function loadLiveOrders(client: SupabaseClient): Promise<DesktopOrder[]> {
  const { data, error } = await client.from('orders').select('*, order_items(*, order_item_addons(*))')
    .neq('order_status', 'completed').neq('order_status', 'cancelled').neq('order_status', 'on_the_way')
    .neq('payment_status', 'refunded').neq('order_status', 'pending_online_payment')
    .or(`scheduled_pickup_at.is.null,scheduled_pickup_at.lte.${new Date(Date.now() + 30 * 60_000).toISOString()}`);
  if (error) throw new Error(error.message);
  return sortDesktopLiveOrders((data ?? []).map(toDesktopOrder).filter((order) => isDesktopLiveOrder(order)));
}
```

Store refresh increments a generation before loading and publishes only when the response generation remains current.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `pnpm --dir apps/pappas-order-management-desktop test -- --run src/features/orders/live-orders-store.test.ts && pnpm --dir apps/pappas-order-management-desktop build`

Expected: PASS.

- [ ] **Step 5: Record task completion without committing**

Run: `git diff --check -- apps/pappas-order-management-desktop/src/features/orders`

Expected: no output.

### Task 3: Add idempotent status-action service

**Files:**
- Create: `apps/pappas-order-management-desktop/src/features/orders/order-action-service.ts`
- Create: `apps/pappas-order-management-desktop/src/features/orders/order-action-service.test.ts`

**Interfaces:**
- Consumes `DesktopOrder` and `DesktopOrderGateway.updateStatus(id, status)`.
- Produces `createOrderActionService({ gateway })` with `updateStatus(orderId, status)` returning `{ kind: 'updated'; order } | { kind: 'failed'; message }`.

- [ ] **Step 1: Write a failing same-order duplicate test**

```ts
it('rejects a second action for the same order while the first is pending', async () => {
  const pending = deferred<DesktopOrder>();
  const service = createOrderActionService({ gateway: { updateStatus: () => pending.promise } });
  const first = service.updateStatus('order-1', 'confirmed');
  await expect(service.updateStatus('order-1', 'ready')).resolves.toEqual({ kind: 'failed', message: 'This order is already being updated.' });
  pending.resolve(order({ id: 'order-1', order_status: 'confirmed' }));
  await expect(first).resolves.toMatchObject({ kind: 'updated' });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir apps/pappas-order-management-desktop test -- --run src/features/orders/order-action-service.test.ts`

Expected: FAIL because the action service does not exist.

- [ ] **Step 3: Implement guarded status mutations**

```ts
const pendingOrderIds = new Set<string>();
async function updateStatus(orderId: string, status: DesktopOrderStatus): Promise<OrderActionOutcome> {
  if (pendingOrderIds.has(orderId)) return { kind: 'failed', message: 'This order is already being updated.' };
  pendingOrderIds.add(orderId);
  try { return { kind: 'updated', order: await gateway.updateStatus(orderId, status) }; }
  catch (error) { return { kind: 'failed', message: error instanceof Error ? error.message : 'Unable to update order.' }; }
  finally { pendingOrderIds.delete(orderId); }
}
```

- [ ] **Step 4: Run focused tests**

Run: `pnpm --dir apps/pappas-order-management-desktop test -- --run src/features/orders/order-action-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Record task completion without committing**

Run: `git diff --check -- apps/pappas-order-management-desktop/src/features/orders`

Expected: no output.

### Task 4: Render the Live Orders workspace, detail drawer, and realtime refresh

**Files:**
- Create: `apps/pappas-order-management-desktop/src/features/orders/LiveOrdersWorkspace.tsx`
- Create: `apps/pappas-order-management-desktop/src/features/orders/OrderDetailDrawer.tsx`
- Create: `apps/pappas-order-management-desktop/src/features/orders/live-orders.css`
- Create: `apps/pappas-order-management-desktop/src/features/orders/LiveOrdersWorkspace.test.tsx`
- Modify: `apps/pappas-order-management-desktop/src/App.tsx`
- Modify: `apps/pappas-order-management-desktop/src/features/pos/PosWorkspace.tsx`

**Interfaces:**
- Consumes Task 2 store/gateway and Task 3 action service.
- Produces an `Orders` navigation target, `LiveOrdersWorkspace`, and `OrderDetailDrawer`.

- [ ] **Step 1: Write failing renderer tests**

```tsx
it('renders the chronological Live Orders queue and opens an order detail drawer', async () => {
  render(<LiveOrdersWorkspace store={readyStore([order({ order_number: 'ORD-10' })])} actions={actions} />);
  await user.click(screen.getByRole('button', { name: /ORD-10/i }));
  expect(screen.getByRole('dialog', { name: /Order ORD-10/i })).toHaveTextContent('Classic burger');
});

it('refreshes on an order-sync notification without changing the cart callback', async () => {
  render(<LiveOrdersWorkspace store={store} actions={actions} subscribeToOrderSync={emitSync} />);
  emitSync(); await waitFor(() => expect(store.refresh).toHaveBeenCalledWith('realtime'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir apps/pappas-order-management-desktop test -- --run src/features/orders/LiveOrdersWorkspace.test.tsx`

Expected: FAIL because the workspace does not exist.

- [ ] **Step 3: Implement accessible desktop queue and drawer**

Render one chronological queue with named buttons per order. Provide explicit loading, retryable error, stale-refresh, and empty states. The drawer uses `role="dialog"`, shows full items/totals/notes, and disables only the action buttons for its pending order. Subscribe to `order_sync_state` on mount, debounce `store.refresh('realtime')` by 250ms, and unsubscribe on cleanup.

- [ ] **Step 4: Wire navigation from New Order**

Add an `Orders` header action to `PosWorkspace`. In `App`, retain the authenticated Supabase client and switch between `new-order` and `live-orders` views without recreating the cart store or logging the user out.

- [ ] **Step 5: Run focused renderer tests and build**

Run: `pnpm --dir apps/pappas-order-management-desktop test -- --run src/features/orders/LiveOrdersWorkspace.test.tsx && pnpm --dir apps/pappas-order-management-desktop build`

Expected: PASS.

- [ ] **Step 6: Record task completion without committing**

Run: `git diff --check -- apps/pappas-order-management-desktop/src`

Expected: no output.

### Task 5: Add desktop order history to the shared Orders workspace

**Files:**
- Create: `apps/pappas-order-management-desktop/src/features/orders/order-history-store.ts`
- Create: `apps/pappas-order-management-desktop/src/features/orders/order-history-store.test.ts`
- Create: `apps/pappas-order-management-desktop/src/features/orders/OrderHistoryPane.tsx`
- Modify: `apps/pappas-order-management-desktop/src/features/orders/LiveOrdersWorkspace.tsx`

**Interfaces:**
- Consumes `DesktopOrderGateway.loadHistory({ date, orderStatus, paymentStatus })`.
- Produces `OrderHistoryPane` sharing `OrderDetailDrawer` with Live Orders.

- [ ] **Step 1: Write a failing date/filter test**

```ts
it('passes the selected local calendar day and payment filter to the gateway', async () => {
  const gateway = { loadHistory: vi.fn().mockResolvedValue([]) };
  const store = createOrderHistoryStore({ gateway });
  await store.refresh({ date: '2026-09-24', paymentStatus: 'paid' });
  expect(gateway.loadHistory).toHaveBeenCalledWith({ date: '2026-09-24', paymentStatus: 'paid' });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir apps/pappas-order-management-desktop test -- --run src/features/orders/order-history-store.test.ts`

Expected: FAIL because the history store does not exist.

- [ ] **Step 3: Implement history store and pane**

Use the existing Australia/Melbourne date boundary contract in the gateway, retain prior results during refresh failures, and make a history row open the same authoritative detail drawer.

- [ ] **Step 4: Run focused tests and build**

Run: `pnpm --dir apps/pappas-order-management-desktop test -- --run src/features/orders/order-history-store.test.ts && pnpm --dir apps/pappas-order-management-desktop build`

Expected: PASS.

- [ ] **Step 5: Record task completion without committing**

Run: `git diff --check -- apps/pappas-order-management-desktop/src/features/orders`

Expected: no output.

### Task 6: Add safe desktop print preparation and transport boundary

**Files:**
- Create: `apps/pappas-order-management-desktop/src/features/printing/desktop-print-service.ts`
- Create: `apps/pappas-order-management-desktop/src/features/printing/desktop-print-service.test.ts`
- Create: `apps/pappas-order-management-desktop/src/features/printing/DesktopPrintPanel.tsx`
- Modify: `apps/pappas-order-management-desktop/src/features/orders/OrderDetailDrawer.tsx`
- Modify: `apps/pappas-order-management-desktop/src-tauri/src/main.rs`
- Modify: `apps/pappas-order-management-desktop/src-tauri/capabilities/default.json`

**Interfaces:**
- Consumes an authoritative `DesktopOrder` and `PosPrinterService.print(bytes, metadata)`.
- Produces `createDesktopPrintService({ renderKitchenDocument, printer })` and a manual Print action in the detail drawer.

- [ ] **Step 1: Write a failing failed-transport test**

```ts
it('returns a print failure without mutating the persisted order', async () => {
  const order = completeOrder();
  const service = createDesktopPrintService({ renderKitchenDocument: () => new Uint8Array([1]), printer: { print: async () => ({ ok: false, code: 'UNAVAILABLE', message: 'Printer unavailable' }) } });
  await expect(service.printKitchen(order)).resolves.toEqual({ kind: 'failed', message: 'Printer unavailable' });
  expect(order).toEqual(completeOrder());
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir apps/pappas-order-management-desktop test -- --run src/features/printing/desktop-print-service.test.ts`

Expected: FAIL because the print service does not exist.

- [ ] **Step 3: Implement prepare-then-transport printing**

Fetch the latest order detail before preparing the kitchen document. Reject automatic printing for non-paid cash/card orders. For manual printing, return a clear unavailable result until the Tauri printer adapter is implemented; do not change order/payment state in any print path.

- [ ] **Step 4: Add a minimal Tauri print command only after Rust tests define its payload contract**

Create a Rust unit test that rejects empty byte payloads and arbitrary destination strings. Register only the fixed command and capability permission needed by `DesktopPrintPanel`; do not expose shell, filesystem, or network permissions.

- [ ] **Step 5: Run focused tests, Rust checks, and renderer build**

Run: `pnpm --dir apps/pappas-order-management-desktop test -- --run src/features/printing && cargo test --manifest-path apps/pappas-order-management-desktop/src-tauri/Cargo.toml && pnpm --dir apps/pappas-order-management-desktop build`

Expected: PASS.

- [ ] **Step 6: Record task completion without committing**

Run: `git diff --check -- apps/pappas-order-management-desktop/src apps/pappas-order-management-desktop/src-tauri`

Expected: no output.
