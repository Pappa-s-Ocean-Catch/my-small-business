# Reward Award on Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Award reward points once for eligible paid customer orders at POS completion, preserve receipt-claim rewards, eliminate online-payment duplicate awards, and provide immediate completion feedback in POS.

**Architecture:** The database owns reward eligibility at the `orders` transition to `completed`, with a partial unique index as the final idempotency boundary. Stripe and confirmation handlers retain payment and delivery processing but no longer allocate rewards. Receipt claims keep their established customer-linking plus reward allocation flow and use the same unique index. The POS uses its existing order-scoped status state to show an immediate progress indicator and prevent duplicate taps.

**Tech Stack:** PostgreSQL/Supabase migrations, Next.js route handlers/server actions, React Native/Expo, react-native-paper, Node.js built-in test runner, TypeScript.

## Global Constraints

- Award only when `payment_status = 'paid'`, the order transitions into `completed`, `order_channel <> 'third_party'`, and `user_id` belongs to a `profiles.role_slug = 'customer'` profile.
- Virtual `INSTORE` orders must not be completion-awarded; receipt-claim customer linking and rewards remain unchanged.
- Online payment, Stripe webhooks, Shipday creation, order confirmation, and payment analytics must retain their present behavior other than not allocating rewards.
- A failed duplicate reward insert must not fail an otherwise valid POS completion update.
- Preserve the user’s unrelated mobile About-screen edits; do not stage or modify them.

---

## File Structure

- `supabase/migrations/20260812120000_reward_award_on_completion.sql` — cleans duplicate earned ledger rows, reconciles affected balances, adds the partial unique index, and replaces the completion trigger with the final eligibility predicate.
- `supabase/tests/reward_award_on_completion.sql` — disposable local-Supabase fixture and assertions for the migration.
- `apps/web/src/app/api/webhooks/stripe/route.ts` — removes payment-time reward calls only.
- `apps/web/src/app/api/payments/verify-session/route.ts` — removes payment-time reward calls only.
- `apps/web/src/app/actions/orders.ts` — removes its second completion-time application award; the database trigger becomes canonical.
- `apps/pappas-order-management/lib/orders.ts` and `apps/pappas-order-management/lib/reward-points.ts` — remove the POS follow-up reward request because the completed-order trigger awards atomically.
- `apps/pappas-order-management/components/LiveOrderListItem.tsx` — visibly renders the existing order-scoped loading state on the quick action button.
- `apps/pappas-order-management/components/OrderDetailModal.tsx` — makes completion progress explicit in the detail action surface while preserving disabled controls.
- `apps/pappas-order-management/lib/order-status-feedback.ts` and `apps/pappas-order-management/test/order-status-feedback.test.ts` — provide a small, testable UI-state contract shared by card/detail components.

### Task 1: Add a testable POS completion-feedback contract

**Files:**
- Create: `apps/pappas-order-management/lib/order-status-feedback.ts`
- Create: `apps/pappas-order-management/test/order-status-feedback.test.ts`

**Interfaces:**
- Produces: `getOrderActionFeedback(orderId: string, updatingStatus: string | null, actionLabel: string): { isUpdating: boolean; label: string }`
- Consumers: `LiveOrderListItem` and `OrderDetailModal`.

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { getOrderActionFeedback } from '../lib/order-status-feedback';

test('shows completion progress only for the order being updated', () => {
  assert.deepEqual(getOrderActionFeedback('order-a', 'order-a', 'Complete'), {
    isUpdating: true,
    label: 'Completing…',
  });
  assert.deepEqual(getOrderActionFeedback('order-b', 'order-a', 'Complete'), {
    isUpdating: false,
    label: 'Complete',
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- order-status-feedback.test.js`

Expected: the test compilation fails because `../lib/order-status-feedback` does not exist.

- [ ] **Step 3: Write the minimal implementation**

```ts
export function getOrderActionFeedback(
  orderId: string,
  updatingStatus: string | null,
  actionLabel: string,
): { isUpdating: boolean; label: string } {
  const isUpdating = updatingStatus === orderId;
  return {
    isUpdating,
    label: isUpdating && actionLabel === 'Complete' ? 'Completing…' : actionLabel,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit -- order-status-feedback.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pappas-order-management/lib/order-status-feedback.ts apps/pappas-order-management/test/order-status-feedback.test.ts
git commit -m "test: cover POS completion feedback state"
```

### Task 2: Make POS completion progress visible in both action surfaces

**Files:**
- Modify: `apps/pappas-order-management/components/LiveOrderListItem.tsx:67-189`
- Modify: `apps/pappas-order-management/components/OrderDetailModal.tsx:168-373`

**Interfaces:**
- Consumes: `getOrderActionFeedback` from Task 1.
- Produces: per-order `loading`, disabled state, and `Completing…` label for the Complete quick action.

- [ ] **Step 1: Confirm the existing test stays green before UI integration**

Run: `pnpm --filter pappas-order-management test:unit -- order-status-feedback.test.js`

Expected: PASS.

- [ ] **Step 2: Apply the minimal UI integration**

```tsx
const actionFeedback = getOrderActionFeedback(order.id, updatingStatus, quickAction.label);

<PaperButton
  mode="contained"
  onPress={() => onQuickAction(order, quickAction.action)}
  loading={actionFeedback.isUpdating}
  disabled={actionFeedback.isUpdating || smartpayProcessing}
>
  {actionFeedback.label}
</PaperButton>
```

Use the same feedback object in `OrderDetailModal`. Do not change the existing `useOrderActions` ordering: it already sets `updatingStatus` before the completed-order freshness fetch and keeps it set through the update/payment selection.

- [ ] **Step 3: Verify type checking and UI behavior**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

Manual check on a POS device/simulator:

1. Tap Complete on a paid live-order card: the button immediately shows a spinner/`Completing…` and cannot be tapped again.
2. Open the same order and tap Complete: the detail action shows the same progress state.
3. Confirm a different order remains actionable.
4. Force a status-update error: progress clears and the order remains actionable.

- [ ] **Step 4: Commit**

```bash
git add apps/pappas-order-management/components/LiveOrderListItem.tsx apps/pappas-order-management/components/OrderDetailModal.tsx
git commit -m "fix: show POS completion progress"
```

### Task 3: Enforce database-owned reward eligibility and repair existing duplicates

**Files:**
- Create: `supabase/tests/reward_award_on_completion.sql`
- Create: `supabase/migrations/20260812120000_reward_award_on_completion.sql`

**Interfaces:**
- Produces: `ensure_reward_points_for_completed_order()` trigger function and `reward_point_transactions_one_earned_per_order` partial unique index.
- Consumes: `orders`, `profiles`, `settings`, `reward_point_transactions`, and `user_reward_points` tables.

- [ ] **Step 1: Write the failing migration verification fixture first**

Create `supabase/tests/reward_award_on_completion.sql` for a disposable local-Supabase database. It must seed:

```sql
-- one completed paid online order with a linked customer profile
-- one completed paid third_party order with a linked customer profile
-- one completed paid order linked to a non-customer profile
-- one completed paid virtual INSTORE order without user_id
-- one order with two earned transactions, where the earlier row must survive
```

Use `DO $$ BEGIN ... RAISE EXCEPTION ...; END $$;` assertions to verify:

```sql
-- exactly one earned transaction remains for the duplicate order
-- affected current_balance equals the ledger sum after cleanup
-- only the eligible customer order receives an earned transaction on completion
-- no second earned row is inserted if the completed order is updated again
-- marketplace, non-customer, and virtual INSTORE orders receive none
```


- [ ] **Step 2: Run the fixture before the migration to verify it fails**

Run against a disposable local Supabase database after reset.

Expected: FAIL because the trigger currently permits an eligible completed order without the new profile/channel guards and the database lacks the partial unique index.

- [ ] **Step 3: Implement the migration transactionally**

Implement in this exact order:

```sql
-- A. select later duplicate earned rows by row_number() over
--    (partition by order_id order by created_at, id), retain row_number = 1.
-- B. delete only row_number > 1 and retain their user_ids in a CTE.
-- C. recompute totals/current_balance for only those users from their remaining ledger.
-- D. create unique index reward_point_transactions_one_earned_per_order
--    on public.reward_point_transactions(order_id)
--    where transaction_type = 'earned' and order_id is not null.
-- E. replace the completion trigger function. Guard with OLD.order_status
--    IS DISTINCT FROM 'completed', paid status, non-third_party channel,
--    non-null user_id, a customer profile exists, enabled rewards, and a
--    positive subtotal. Use INSERT ... ON CONFLICT DO NOTHING.
```

The trigger must calculate its balance with `COALESCE`, and it must not throw on an already-earned order. Leave the reward-balance ledger trigger in place.

- [ ] **Step 4: Apply the migration to the fixture and verify it passes**

Run `supabase db reset` followed by the fixture script after the migration.

Expected: all assertions pass; a repeated update of an already completed order remains successful and does not create a new earned row.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260812120000_reward_award_on_completion.sql supabase/tests/reward_award_on_completion.sql
git commit -m "fix: enforce one eligible reward per completed order"
```

### Task 4: Remove all payment-time and client-side completion award paths

**Files:**
- Modify: `apps/web/src/app/api/webhooks/stripe/route.ts:5,99-103,161-164`
- Modify: `apps/web/src/app/api/payments/verify-session/route.ts:5,102-108,150-154`
- Modify: `apps/web/src/app/actions/orders.ts:1053-1063`
- Modify: `apps/pappas-order-management/lib/orders.ts:1-5,414-419`
- Modify: `apps/pappas-order-management/lib/reward-points.ts:77-120`

**Interfaces:**
- Produces: payment handlers that update payment/order status, delivery, email, and analytics without writing rewards.
- Preserves: `apps/web/src/app/actions/receipt-claims.ts` as the sole post-completion claim award path.

- [ ] **Step 1: Confirm the database eligibility fixture passes before changing callers**

Run: `supabase db reset` then `psql "$SUPABASE_DB_URL" -f supabase/tests/reward_award_on_completion.sql`

Expected: PASS. This proves the completion trigger has become the sole eligible completion-time award path.

- [ ] **Step 2: Remove reward imports and calls**

Remove only `ensureOrderRewardPoints` / `ensureRewardPointsForOrder` imports and calls from the listed payment and completion paths. Keep all surrounding status updates, response payloads, Shipday handling, email dispatch, and PostHog capture untouched. Delete the now-unused mobile `ensureRewardPointsForOrder` wrapper from `lib/reward-points.ts`.

- [ ] **Step 3: Confirm receipt claims remain intact**

Do not alter `apps/web/src/app/actions/receipt-claims.ts`; its `user_id` update and `earnRewardPoints` calls are intentional.

- [ ] **Step 4: Run focused static verification**

Run:

```bash
rg -n "ensureOrderRewardPoints|ensureRewardPointsForOrder" apps/web/src/app/api apps/web/src/app/actions/orders.ts apps/pappas-order-management/lib apps/web/src/app/actions/receipt-claims.ts
pnpm --filter web lint
pnpm --filter pappas-order-management test:unit
```

Expected: only receipt-claim reward usage remains; lint and unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/webhooks/stripe/route.ts apps/web/src/app/api/payments/verify-session/route.ts apps/web/src/app/actions/orders.ts apps/pappas-order-management/lib/orders.ts apps/pappas-order-management/lib/reward-points.ts
git commit -m "fix: award rewards only from database completion flow"
```

### Task 5: End-to-end verification

**Files:**
- Modify only if earlier tasks reveal a type or lint failure.

- [ ] **Step 1: Run complete checks**

Run:

```bash
pnpm --filter pappas-order-management test:unit
pnpm --filter web lint
pnpm --filter web build
git diff --check
git status --short
```

Expected: all checks pass, no whitespace errors, and only intended reward/POS files plus the user’s pre-existing About-screen edits are modified.

- [ ] **Step 2: Exercise payment and completion paths manually**

1. Complete an eligible paid online delivery order in POS: Stripe still marks it paid/confirmed; no reward exists before completion; exactly one exists after completion.
2. Complete a paid third-party marketplace order: no reward is created.
3. Complete a paid virtual `INSTORE` order: no reward is created.
4. Claim a paid eligible in-store receipt: it links the customer and awards one reward; retrying the claim does not add another.
5. Complete an eligible paid POS order from both card and detail UI: visible progress appears immediately and duplicate taps are blocked.
