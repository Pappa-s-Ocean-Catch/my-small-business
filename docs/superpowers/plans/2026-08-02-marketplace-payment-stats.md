# Marketplace Payment Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Report paid marketplace orders separately from cash throughout POS completed-order statistics and sales-report payment breakdowns.

**Architecture:** Extend the existing shared order utility with a three-way payment-stat classifier. Both the completed-order screen and report consume that classifier, making marketplace-channel precedence a single tested rule instead of separate UI fallbacks.

**Tech Stack:** TypeScript, Expo/React Native, Node test runner.

## Global Constraints

- A normalized `third_party` order channel classifies as `marketplace` before payment-method inspection.
- Marketplace orders remain included in paid-order and gross-sales totals but never Cash or Card payment totals.
- Direct non-marketplace card/cash behavior remains unchanged.
- Do not change the existing Channel or Channel financials report sections.

---

## File Structure

- Modify: `apps/pappas-order-management/utils/orderUtils.ts` — add the shared payment-stat type, classifier, and display label.
- Modify: `apps/pappas-order-management/test/order-utils.test.ts` — cover marketplace precedence and existing direct-payment classifications.
- Modify: `apps/pappas-order-management/tsconfig.test.json` — include the new unit test.
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/orders.tsx` — render and filter the Marketplace completed-order statistic.
- Modify: `apps/pappas-order-management/app/(drawer)/report.tsx` — label marketplace payment totals correctly.

### Task 1: Establish shared payment-stat classification with tests

**Files:**
- Create: `apps/pappas-order-management/test/order-utils.test.ts`
- Modify: `apps/pappas-order-management/utils/orderUtils.ts:408-427`
- Modify: `apps/pappas-order-management/tsconfig.test.json:12-31`

**Interfaces:**
- Produces: `PaymentStatType = 'card' | 'cash' | 'marketplace'`.
- Produces: `getPaymentStatType(order: Order): PaymentStatType` and `getPaymentStatLabel(order: Order): 'Card' | 'Cash' | 'Marketplace'`.
- Keeps: `getPaymentMethodType(order)` as the direct-payment card/cash classifier for presentation compatibility.

- [ ] **Step 1: Write failing classifier tests**

```ts
test('classifies paid marketplace imports before their cash-like payment fields', () => {
  assert.equal(getPaymentStatType({ ...baseOrder, order_channel: 'third_party', delivery_partner_name: 'Uber Eats', payment_method: 'store' }), 'marketplace');
  assert.equal(getPaymentStatType({ ...baseOrder, order_channel: 'THIRD_PARTY', delivery_partner_name: 'DoorDash', payment_method: null }), 'marketplace');
});

test('retains direct card and cash classifications', () => {
  assert.equal(getPaymentStatType({ ...baseOrder, order_channel: 'instore', payment_method: 'online' }), 'card');
  assert.equal(getPaymentStatType({ ...baseOrder, order_channel: 'instore', payment_method: 'store', payment_method_detail: 'Cash' }), 'cash');
});
```

- [ ] **Step 2: Verify the tests fail for the absent API**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL with an import or missing-export error for `getPaymentStatType`.

- [ ] **Step 3: Implement the minimal shared rule**

```ts
export type PaymentStatType = 'card' | 'cash' | 'marketplace';

export const getPaymentStatType = (order: Order): PaymentStatType => {
  if (getOrderChannel(order) === 'third_party') return 'marketplace';
  return getPaymentMethodType(order);
};

export const getPaymentStatLabel = (order: Order): 'Card' | 'Cash' | 'Marketplace' => {
  const type = getPaymentStatType(order);
  return type === 'marketplace' ? 'Marketplace' : type === 'card' ? 'Card' : 'Cash';
};
```

- [ ] **Step 4: Verify the focused suite passes**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

- [ ] **Step 5: Commit the tested shared classifier**

```bash
git add apps/pappas-order-management/utils/orderUtils.ts apps/pappas-order-management/test/order-utils.test.ts apps/pappas-order-management/tsconfig.test.json
git commit -m "fix(pos): classify marketplace payment stats"
```

### Task 2: Apply the classifier to all completed-order and report payment totals

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/orders.tsx:35,100-133,205-271`
- Modify: `apps/pappas-order-management/app/(drawer)/report.tsx:26,467-474`

**Interfaces:**
- Consumes: `getPaymentStatType` and `getPaymentStatLabel` from `utils/orderUtils.ts`.
- Produces: a third Marketplace quick-stat tile and matching order-list filter; a Card/Cash/Marketplace report payment breakdown.

- [ ] **Step 1: Change completed-order totals to use the shared classifier**

```ts
let totalMarketplace = 0;
const paymentType = getPaymentStatType(order);
if (paymentType === 'card') totalCard += order.total;
else if (paymentType === 'marketplace') totalMarketplace += order.total;
else totalCash += order.total;
```

Change `paymentMethodFilter` to accept `'marketplace'`, filter through `getPaymentStatType`, and add a Marketplace tile using the same toggle pattern as Card and Cash.

- [ ] **Step 2: Change the sales-report payment breakdown to use the shared label**

```ts
const paymentBreakdown = useMemo(
  () => buildBreakdown(currentOrders, (order) => getPaymentStatLabel(order)),
  [currentOrders]
);
```

- [ ] **Step 3: Type-check the POS app**

Run: `pnpm --filter pappas-order-management exec tsc -p tsconfig.json --noEmit`

Expected: exit code 0.

- [ ] **Step 4: Run the full POS unit suite and whitespace validation**

Run: `pnpm --filter pappas-order-management test:unit && git diff --check`

Expected: both commands exit 0.

- [ ] **Step 5: Commit the report and completed-order UI correction**

```bash
git add apps/pappas-order-management/app/'(drawer)'/'(tabs)'/orders.tsx apps/pappas-order-management/app/'(drawer)'/report.tsx
git commit -m "fix(pos): separate marketplace payment totals"
```
