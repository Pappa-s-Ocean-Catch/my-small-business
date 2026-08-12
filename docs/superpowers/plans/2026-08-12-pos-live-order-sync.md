# POS Live Order Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize Live Orders on every POS after all order changes, without touching the new-order cart, and reload every list tab when focused.

**Architecture:** PostgreSQL advances a singleton Realtime signal transactionally from an `orders` trigger. A root POS provider debounces signal events then invalidates only list query caches; focused list screens refetch their own data.

**Tech Stack:** Supabase PostgreSQL/Realtime, Expo Router, TanStack React Query, TypeScript, Node built-in test runner.

## Global Constraints

- A database trigger, not individual actions, covers every `orders` insert, update, and delete.
- Realtime refreshes only `LIVE_ORDERS_QUERY_KEY`, `ON_THE_WAY_ORDERS_QUERY_KEY`, `PRE_ORDER_COUNT_QUERY_KEY`, and `PRE_ORDERS_QUERY_KEY`.
- No sync code may navigate, dismiss modals, change the POS cart, or await a query refresh from an order mutation.
- Keep `PrinterAutomationProvider`'s direct orders subscription because it controls printing/announcements.
- Pre-orders and history reload on focus; Live Orders retains its existing eligibility timer.

---

## File Structure

- `supabase/migrations/20260812130000_add_order_sync_state.sql` — sync table, trigger, RLS, publication.
- `supabase/tests/order_sync_state.sql` — SQL trigger assertions.
- `apps/pappas-order-management/lib/order-list-sync.ts` — pure debounce and key definitions.
- `apps/pappas-order-management/test/order-list-sync.test.ts` — debounce/key tests.
- `apps/pappas-order-management/providers/OrderListSyncProvider.tsx` — singleton Realtime subscription.
- `apps/pappas-order-management/app/_layout.tsx` — provider mount.
- `apps/pappas-order-management/app/(drawer)/pre-orders.tsx` — remove redundant list subscription; retain focus refetch.
- `apps/pappas-order-management/app/(drawer)/(tabs)/completed.tsx` — add history focus refetch.
- `apps/pappas-order-management/tsconfig.test.json` — include pure test module.

### Task 1: Add the database-owned sync signal

**Files:**

- Create: `supabase/migrations/20260812130000_add_order_sync_state.sql`
- Create: `supabase/tests/order_sync_state.sql`

**Interfaces:**

- Produces `public.order_sync_state(singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton), updated_at TIMESTAMPTZ NOT NULL)` with one row.
- Produces `public.bump_order_sync_state() RETURNS TRIGGER`, executed after each `orders` insert, update, and delete.

- [ ] **Step 1: Write the failing database fixture**

```sql
BEGIN;
INSERT INTO public.order_sync_state (singleton, updated_at) VALUES (TRUE, '2026-08-12T00:00:00Z') ON CONFLICT (singleton) DO UPDATE SET updated_at = EXCLUDED.updated_at;
DO $$
DECLARE before_insert TIMESTAMPTZ; after_insert TIMESTAMPTZ; after_update TIMESTAMPTZ; after_delete TIMESTAMPTZ; order_id UUID;
BEGIN
  SELECT updated_at INTO before_insert FROM public.order_sync_state WHERE singleton;
  INSERT INTO public.orders (order_number, customer_name, customer_email, customer_phone, order_type, payment_method, subtotal, tax, delivery_fee, service_fee, total) VALUES ('SYNC-TEST-1', 'Sync Test', 'sync@example.invalid', '0400000000', 'pickup', 'cash', 1, 0, 0, 0, 1) RETURNING id INTO order_id;
  SELECT updated_at INTO after_insert FROM public.order_sync_state WHERE singleton;
  IF after_insert <= before_insert THEN RAISE EXCEPTION 'insert did not advance sync'; END IF;
  UPDATE public.orders SET order_status = 'confirmed' WHERE id = order_id;
  SELECT updated_at INTO after_update FROM public.order_sync_state WHERE singleton;
  IF after_update <= after_insert THEN RAISE EXCEPTION 'update did not advance sync'; END IF;
  DELETE FROM public.orders WHERE id = order_id;
  SELECT updated_at INTO after_delete FROM public.order_sync_state WHERE singleton;
  IF after_delete <= after_update THEN RAISE EXCEPTION 'delete did not advance sync'; END IF;
END $$;
ROLLBACK;
```

- [ ] **Step 2: Verify RED**

Run: `supabase test db --file supabase/tests/order_sync_state.sql`

Expected: FAIL because `order_sync_state` does not exist.

- [ ] **Step 3: Implement the migration**

```sql
CREATE TABLE IF NOT EXISTS public.order_sync_state (singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton), updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());
INSERT INTO public.order_sync_state (singleton) VALUES (TRUE) ON CONFLICT (singleton) DO NOTHING;
ALTER TABLE public.order_sync_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_sync_state_staff_select ON public.order_sync_state;
CREATE POLICY order_sync_state_staff_select ON public.order_sync_state FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role_slug = 'staff'));
CREATE OR REPLACE FUNCTION public.bump_order_sync_state() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.order_sync_state (singleton, updated_at) VALUES (TRUE, clock_timestamp()) ON CONFLICT (singleton) DO UPDATE SET updated_at = EXCLUDED.updated_at;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP TRIGGER IF EXISTS orders_bump_sync_state ON public.orders;
CREATE TRIGGER orders_bump_sync_state AFTER INSERT OR UPDATE OR DELETE ON public.orders FOR EACH STATEMENT EXECUTE FUNCTION public.bump_order_sync_state();
```

Add the table idempotently to `supabase_realtime` and set `REPLICA IDENTITY FULL`, using the existing orders-realtime migration pattern.

- [ ] **Step 4: Verify GREEN**

Run: `supabase db reset && supabase test db --file supabase/tests/order_sync_state.sql`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add supabase/migrations/20260812130000_add_order_sync_state.sql supabase/tests/order_sync_state.sql && git commit -m "feat: add transactional POS order sync signal"`

### Task 2: Add a testable debounced list-sync coordinator

**Files:**

- Create: `apps/pappas-order-management/lib/order-list-sync.ts`
- Create: `apps/pappas-order-management/test/order-list-sync.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**

- Produces `ORDER_LIST_SYNC_QUERY_KEYS` and `createOrderListSync(onFlush, delayMs?)`.
- `notify()` coalesces signals; `dispose()` cancels pending work.

- [ ] **Step 1: Write failing tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createOrderListSync, ORDER_LIST_SYNC_QUERY_KEYS } from '../lib/order-list-sync';
test('coalesces realtime signals into one refresh', async () => { let calls = 0; const sync = createOrderListSync(() => { calls += 1; }, 5); sync.notify(); sync.notify(); sync.notify(); await new Promise((resolve) => setTimeout(resolve, 10)); assert.equal(calls, 1); sync.dispose(); });
test('cancels queued refresh on dispose', async () => { let calls = 0; const sync = createOrderListSync(() => { calls += 1; }, 5); sync.notify(); sync.dispose(); await new Promise((resolve) => setTimeout(resolve, 10)); assert.equal(calls, 0); });
test('declares only order-list keys', () => assert.deepEqual(ORDER_LIST_SYNC_QUERY_KEYS, [['live-orders'], ['on-the-way-orders'], ['live-orders', 'pre-order-count'], ['pre-orders']]));
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter pappas-order-management test:unit -- order-list-sync.test.js`

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement the minimal module**

```ts
export const ORDER_LIST_SYNC_QUERY_KEYS = [['live-orders'], ['on-the-way-orders'], ['live-orders', 'pre-order-count'], ['pre-orders']] as const;
export function createOrderListSync(onFlush: () => void, delayMs = 250) {
  let timer: ReturnType<typeof setTimeout> | null = null; let disposed = false;
  return { notify() { if (disposed || timer) return; timer = setTimeout(() => { timer = null; if (!disposed) onFlush(); }, delayMs); }, dispose() { disposed = true; if (timer) clearTimeout(timer); timer = null; } };
}
```

Add the module to `tsconfig.test.json`.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm --filter pappas-order-management test:unit -- order-list-sync.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/pappas-order-management/lib/order-list-sync.ts apps/pappas-order-management/test/order-list-sync.test.ts apps/pappas-order-management/tsconfig.test.json && git commit -m "test: cover POS order sync batching"`

### Task 3: Subscribe once and invalidate only list queries

**Files:**

- Create: `apps/pappas-order-management/providers/OrderListSyncProvider.tsx`
- Modify: `apps/pappas-order-management/app/_layout.tsx`

**Interfaces:**

- Consumes the pure coordinator, `supabase`, and React Query.
- Produces one `order-list-sync-state` Realtime channel while the POS app is mounted.

- [ ] **Step 1: Implement the provider effect**

```tsx
useEffect(() => {
  const sync = createOrderListSync(() => { ORDER_LIST_SYNC_QUERY_KEYS.forEach((queryKey) => { void queryClient.invalidateQueries({ queryKey }); }); });
  const channel = supabase.channel('order-list-sync-state').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_sync_state' }, () => sync.notify()).subscribe();
  return () => { sync.dispose(); void supabase.removeChannel(channel); };
}, [queryClient]);
```

The provider returns `children` unchanged and cannot import router, cart stores, alert APIs, or list-screen state.

- [ ] **Step 2: Mount and verify**

Mount within `QueryClientProvider` around the existing provider tree. Run: `pnpm --filter pappas-order-management test:unit && pnpm --filter pappas-order-management exec tsc --noEmit`

Expected: both commands exit 0.

- [ ] **Step 3: Commit**

Run: `git add apps/pappas-order-management/providers/OrderListSyncProvider.tsx apps/pappas-order-management/app/_layout.tsx && git commit -m "feat: refresh POS order lists from sync events"`

### Task 4: Refresh tabs on focus

**Files:**

- Modify: `apps/pappas-order-management/app/(drawer)/pre-orders.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/completed.tsx`

**Interfaces:**

- Pre-orders retains focus reload but removes the redundant `pre-orders-changes` channel.
- History calls its current filtered `loadOrders` callback when focused.

- [ ] **Step 1: Implement focus reloads**

In both files, make `loadOrders` a `useCallback`. In Pre-orders remove the `supabase` import and direct realtime effect, retaining `useFocusEffect(useCallback(() => { void loadOrders(); }, [loadOrders]))`. In history import `useFocusEffect` from `expo-router`, retain filter-change loading, and add that same focus effect. Never reset filters, selected order, modal visibility, or navigation.

- [ ] **Step 2: Verify**

Run: `pnpm --filter pappas-order-management test:unit && pnpm --filter pappas-order-management exec tsc --noEmit`

Expected: both commands exit 0.

- [ ] **Step 3: Commit**

Run: `git add apps/pappas-order-management/app/'(drawer)'/pre-orders.tsx apps/pappas-order-management/app/'(drawer)'/'(tabs)'/completed.tsx && git commit -m "fix: refresh POS order lists on tab focus"`

### Task 5: Acceptance verification

**Files:** No production changes.

- [ ] **Step 1: Run fresh automated checks**

Run: `supabase db reset && supabase test db --file supabase/tests/order_sync_state.sql && pnpm --filter pappas-order-management test:unit && pnpm --filter pappas-order-management exec tsc --noEmit`

Expected: all commands exit 0.

- [ ] **Step 2: Perform two-terminal acceptance**

1. Open Live Orders on B; complete, mark paid, and cancel orders on A.
2. Confirm B updates each action automatically.
3. Start a New Order on B, enter cart/customer draft data, change an order on A, and confirm B's route/draft is unchanged.
4. Switch B to Pre-orders, history, and Live Orders; confirm each fetches current data while preserving filters and open overlays.

- [ ] **Step 3: Inspect scope**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and no unrelated modifications.
