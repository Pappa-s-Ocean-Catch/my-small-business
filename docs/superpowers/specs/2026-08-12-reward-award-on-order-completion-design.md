# Reward Award on Order Completion Design

## Goal

Award customer reward points exactly once, when either a paid eligible order is completed by the POS workflow or an eligible in-store receipt is claimed by a customer. Online payment confirmation must continue to confirm and process delivery orders without awarding points.

## Scope

- Remove payment-time reward allocation from Stripe Checkout webhooks, Stripe PaymentIntent fallback handling, and checkout-session verification.
- Keep those payment paths responsible for payment confirmation, order confirmation, and delivery creation only.
- Keep reward allocation in the database trigger for paid orders that transition to `completed`.
- Preserve the existing receipt-claim reward flow. A successful receipt claim atomically links the order to the claiming customer (`user_id`) and then awards that order's points; this is the intentional exception for eligible in-store receipts claimed after completion.
- Add database enforcement that permits at most one `earned` reward transaction for an order.
- Correct existing duplicate earned transactions by keeping the oldest earned entry for each order and recalculating only affected customer balances.

## Data Flow

1. An online customer pays through Stripe.
2. The Stripe webhook and/or confirmation-page verifier sets the order payment state to `paid` and confirmation state to `confirmed`; neither writes a reward transaction.
3. POS staff finishes the order and sets `order_status` to `completed`.
4. The `orders` completion trigger awards points only when `payment_status = 'paid'`, the order is not a marketplace order, the status transitions from a non-completed state to `completed`, and `user_id` identifies a `customer` profile rather than the virtual `INSTORE` placeholder.
5. A customer may instead claim an eligible in-store receipt after completion. The existing claim action links `user_id` and awards the points; it does not update an order-status column and therefore does not invoke the completion trigger.
6. A partial unique index rejects any second `earned` transaction for the same order, regardless of the calling path.

## Database Migration

The migration will run in this order:

1. Identify duplicate `reward_point_transactions` rows where `transaction_type = 'earned'` and `order_id` is not null.
2. Preserve the earliest row for every order, ordered by `created_at` then `id` as a deterministic tie breaker.
3. Delete only the later duplicate rows.
4. Recalculate `current_balance`, earned, used, and expired totals for every customer affected by the deletion. The recalculation follows the existing ledger semantics and does not alter unrelated accounts.
5. Create a partial unique index on `reward_point_transactions(order_id)` for non-null `order_id` values with `transaction_type = 'earned'`.
6. Replace the completion trigger function so it acts only on a transition into `completed`, excludes `third_party` marketplace orders, and requires a linked `profiles.role_slug = 'customer'` account. Its insert is conflict-safe, so a duplicate race does not prevent the POS completion update.

## Error Handling and Compatibility

- Stripe webhook responses and checkout verification retain their existing success/error semantics.
- Removing reward calls does not remove their payment-status updates, event logging, Shipday calls, or email behavior.
- The database constraint provides correctness even if a later code path mistakenly attempts to allocate rewards twice.
- The reward completion trigger retains the existing checks for linked customer, paid payment status, enabled rewards, and positive subtotal; it adds the non-marketplace and customer-profile requirements.
- Receipt claiming remains operationally unchanged, including its existing customer-linking and reward-award behavior. The unique index makes a repeated claim or any concurrent completion path idempotent.

## Verification

- Add a regression test around the payment-processing routes to assert reward allocation is not invoked on payment success.
- Validate the migration using representative duplicate ledger fixtures: it preserves one transaction per order, removes only later entries, and produces correct affected balances.
- Run the relevant web test suite and TypeScript/lint checks available in this workspace.
