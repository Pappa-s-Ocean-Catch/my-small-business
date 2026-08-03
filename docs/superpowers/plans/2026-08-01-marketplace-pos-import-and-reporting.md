# Marketplace POS Import and Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make marketplace POS imports idempotent, status-aware, and removal-safe, while reporting gross sales, gross payout, commission, and net sales by Store, Uber Eats, and DoorDash.

**Architecture:** A pure marketplace-import module owns matching, status conversion, and financial aggregation. POS uses it when creating marketplace orders; a migration stores immutable snapshots and rejects duplicate imports.

**Tech Stack:** Expo/React Native, TypeScript, Supabase/PostgreSQL, Node test runner.

## Global Constraints

- Manual import only; do not add polling or automatic imports.
- Store net sales is `gross sales × 0.90`.
- Uber Eats and DoorDash net sales is `gross payout × 0.90`.
- Commission is `gross sales − gross payout`.
- Exclude cancelled and refunded orders from sales metrics.

---

## File Structure

- Create: `apps/pappas-order-management/lib/marketplace-pos-import.ts` — pure normalization, status, and financial functions.
- Create: `apps/pappas-order-management/test/marketplace-pos-import.test.ts` — unit tests for those rules.
- Modify: `apps/pappas-order-management/tsconfig.test.json` — compile the new module/tests.
- Modify: `apps/pappas-order-management/app/pos.types.ts`, `app/pos.tsx`, and `lib/orders.ts` — import and persistence flow.
- Modify: `apps/pappas-order-management/app/(drawer)/marketplace.tsx` and `app/(drawer)/report.tsx` — preflight and report presentation.
- Modify: `libs/types/order.ts` — order snapshots and `refunded` status.
- Create: `supabase/migrations/20260801120000_add_marketplace_order_snapshots.sql` — database enforcement.

### Task 1: Persist snapshot fields and enforce duplicate imports

**Files:**
- Create: `supabase/migrations/20260801120000_add_marketplace_order_snapshots.sql`
- Modify: `libs/types/order.ts:118-169`

**Interfaces:**
- Produces: `Order.marketplace_gross_sales: number | null`, `Order.marketplace_gross_payout: number | null`, and `Order['order_status']` including `'refunded'`.
- Produces: the `orders_unique_marketplace_import` partial unique index.

- [ ] **Step 1: Add migration assertions and schema changes**

```sql
-- Expected: a third_party Uber Eats order with ID 123 can be inserted once.
-- Expected: a second Uber Eats order with ID 123 is rejected.
-- Expected: a DoorDash order with ID 123 remains valid.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS marketplace_gross_sales DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS marketplace_gross_payout DECIMAL(10,2);
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN ('pending', 'pending_online_payment', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled', 'refunded'));
CREATE UNIQUE INDEX IF NOT EXISTS orders_unique_marketplace_import
  ON public.orders (lower(delivery_partner_name), external_order_number)
  WHERE order_channel = 'third_party' AND external_order_number IS NOT NULL AND btrim(external_order_number) <> '';
```

- [ ] **Step 2: Extend the shared Order type**

```ts
order_status: 'pending' | 'pending_online_payment' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled' | 'refunded';
marketplace_gross_sales: number | null;
marketplace_gross_payout: number | null;
```

- [ ] **Step 3: Type-check and commit**

Run: `pnpm --filter @my-small-business/types exec tsc -p tsconfig.json --noEmit`

Expected: exit code 0.

```bash
git add supabase/migrations/20260801120000_add_marketplace_order_snapshots.sql libs/types/order.ts
git commit -m "feat: persist marketplace order snapshots"
```

### Task 2: Add pure import and reporting rules using TDD

**Files:**
- Create: `apps/pappas-order-management/lib/marketplace-pos-import.ts`
- Create: `apps/pappas-order-management/test/marketplace-pos-import.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**
- Produces: `normalizeMarketplaceName`, `findRemovableIngredientName`, `getMarketplaceOrderStatus`, `isMarketplaceImportDuplicateError`, and `buildChannelFinancialBreakdown`.

- [ ] **Step 1: Write failing tests**

```ts
test('matches No tomato to removable Tomato without case sensitivity', () => {
  assert.equal(findRemovableIngredientName('No tomato', [{ name: 'Tomato', customerCanRemove: true }]), 'Tomato');
});
test('does not remove a non-removable ingredient', () => {
  assert.equal(findRemovableIngredientName('without TOMATO', [{ name: 'Tomato', customerCanRemove: false }]), null);
});
test('maps terminal states', () => {
  assert.equal(getMarketplaceOrderStatus('COMPLETED', null), 'completed');
  assert.equal(getMarketplaceOrderStatus('CANCELLED', null), 'cancelled');
  assert.equal(getMarketplaceOrderStatus('REFUNDED', null), 'refunded');
});
test('calculates finance by channel', () => {
  assert.deepEqual(buildChannelFinancialBreakdown([storeOrder, uberOrder, doordashOrder]).map(row => [row.label, row.grossSales, row.grossPayout, row.commission, row.netSales]), [
    ['Store', 100, null, null, 90], ['Uber Eats', 100, 70, 30, 63], ['DoorDash', 100, 80, 20, 72],
  ]);
});
```

- [ ] **Step 2: Run the suite to verify failure**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement minimal pure functions**

```ts
export function findRemovableIngredientName(optionName: string, ingredients: Array<{ name: string; customerCanRemove: boolean }>) {
  const target = getMarketplaceRemovalCandidate(optionName);
  return ingredients.find((item) => item.customerCanRemove && normalizeMarketplaceName(item.name) === target)?.name ?? null;
}
```

Normalize before all comparisons. Map `refund`, `cancel`, `complete`/`deliver`, `ready`, and `prepar` keywords in marketplace state plus description to `refunded`, `cancelled`, `completed`, `ready`, and `preparing`; otherwise return `confirmed`. Aggregate Store from `order.total`; aggregate marketplace gross from snapshot (fallback `order.total`) and payout from snapshot; skip non-paid, cancelled, and refunded orders.

- [ ] **Step 4: Compile, pass tests, and commit**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

```bash
git add apps/pappas-order-management/lib/marketplace-pos-import.ts apps/pappas-order-management/test/marketplace-pos-import.test.ts apps/pappas-order-management/tsconfig.test.json
git commit -m "feat: add marketplace import reporting rules"
```

### Task 3: Integrate matching, state, snapshots, and duplicate handling

**Files:**
- Modify: `apps/pappas-order-management/app/pos.types.ts:50-54`
- Modify: `apps/pappas-order-management/app/pos.tsx:188-279,940-1120,1665-1729,2620-2690`
- Modify: `apps/pappas-order-management/lib/orders.ts:75-116,546-625`
- Modify: `apps/pappas-order-management/app/(drawer)/marketplace.tsx:414-427,970-990`

**Interfaces:**
- Consumes: Task 2 exports.
- Produces: third-party orders with mapped terminal status and both snapshot values.

- [ ] **Step 1: Add the failing duplicate-error test**

```ts
test('recognizes the marketplace duplicate database error', () => {
  assert.equal(isMarketplaceImportDuplicateError({ code: '23505', message: 'orders_unique_marketplace_import' }), true);
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL until duplicate identification is exported.

- [ ] **Step 3: Implement POS integration**

Extend `RemovableIngredient` with `customer_can_remove`. In the marketplace customization query select `customer_can_remove`; use Task 2 matching so only eligible ingredients are pushed to `removed_ingredients`. Continue recording unmatched invalid removal requests.

For imports, set `order_status` through `getMarketplaceOrderStatus(orderJobState, statusDescription)`, `marketplace_gross_sales` from `totalAmount` (fallback POS total), and `marketplace_gross_payout` from parsed `netPayout`. Keep `payment_status: 'paid'`.

Before Marketplace navigates to POS, query third-party orders using source + external ID; block a known duplicate. In `savePosOrder`, translate Postgres `23505` for `orders_unique_marketplace_import` to `This marketplace order has already been added to POS.` The unique index remains the concurrent-write protection.

- [ ] **Step 4: Run tests/type-check and commit**

Run: `pnpm --filter pappas-order-management test:unit && pnpm --filter pappas-order-management exec tsc -p tsconfig.json --noEmit`

Expected: both exit 0.

```bash
git add apps/pappas-order-management/app/pos.types.ts apps/pappas-order-management/app/pos.tsx apps/pappas-order-management/lib/orders.ts apps/pappas-order-management/app/'(drawer)'/marketplace.tsx apps/pappas-order-management/test/marketplace-pos-import.test.ts
git commit -m "feat: safely import marketplace orders into POS"
```

### Task 4: Render channel financial reporting

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/report.tsx:20-320,650-730`
- Modify: `apps/pappas-order-management/test/marketplace-pos-import.test.ts`

**Interfaces:**
- Consumes: `buildChannelFinancialBreakdown(orders)`.
- Produces: a `Channel financials` panel with Store, Uber Eats, and DoorDash rows.

- [ ] **Step 1: Add failing exclusion coverage**

```ts
test('excludes cancelled and refunded paid orders from channel finance', () => {
  const rows = buildChannelFinancialBreakdown([cancelledOrder, refundedOrder]);
  assert.equal(rows.reduce((count, row) => count + row.orders, 0), 0);
});
```

- [ ] **Step 2: Run the test suite to verify failure**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL until the aggregator excludes both terminal non-sales states.

- [ ] **Step 3: Add the report panel and make gross-sales calculations consistent**

Use the Task 2 sales predicate and gross-sales accessor for headline totals, charts, date buckets, payment/channel breakdowns, and the new panel. Each Channel financials row renders order count, Gross sales, Gross payout (`N/A` for Store/missing snapshot), Commission (`N/A` for Store/missing payout), and Net sales.

```tsx
<Text>Gross sales {money(row.grossSales)}</Text>
<Text>Gross payout {row.grossPayout == null ? 'N/A' : money(row.grossPayout)}</Text>
<Text>Commission {row.commission == null ? 'N/A' : money(row.commission)}</Text>
<Text>Net sales {row.netSales == null ? 'N/A' : money(row.netSales)}</Text>
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter pappas-order-management test:unit && pnpm --filter pappas-order-management exec tsc -p tsconfig.json --noEmit && git diff --check`

Expected: all commands exit 0.

```bash
git add apps/pappas-order-management/app/'(drawer)'/report.tsx apps/pappas-order-management/test/marketplace-pos-import.test.ts
git commit -m "feat: report marketplace gross payout and net sales"
```

