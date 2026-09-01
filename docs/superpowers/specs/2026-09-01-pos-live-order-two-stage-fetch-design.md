# POS Live Order Two-Stage Fetch Design

## Goal

Reduce recurring POS work by selecting lightweight open-order candidates first and fetching item/add-on details only for orders that a screen or workflow will actually use.

## Scope and invariants

- The operational source window is the preceding 14 days, measured from `orders.created_at`.
- Candidate rows exclude `completed`, `cancelled`, `refunded`, and `pending_online_payment` order statuses, plus `refunded` payment statuses.
- The existing `getLiveOrderEligibility` function remains the authority for Live Orders: it uses pickup time, keeps future preorders out of the live queue, and excludes `on_the_way` orders.
- A Live Order card, print action, order modal, delivery refresh, and customer action must continue to receive the existing full `Order` shape including items and item add-ons.
- Preorder count must not load item/add-on payloads. The Preorders screen may load full details, but only for eligible preorder IDs in the 14-day source window.
- The printer scheduler retains its existing seven-day-back-to-30-minute-ahead pickup window and auto-print status rules.
- Marketplace history reconciliation is out of scope for this change.

## Architecture

`lib/orders.ts` will expose an order-candidate query that selects only `id`, `created_at`, `scheduled_pickup_at`, `order_status`, and `payment_status`, plus a full-detail query that accepts explicit order IDs. The candidate query applies the 14-day, open-status, and non-refunded-payment constraints in Supabase. The detail query keeps the existing embedded `order_items`/`order_item_addons` select.

`useLiveOrdersQuery.ts` will evaluate candidates locally with the existing eligibility functions, then hydrate only the selected IDs. It will preserve pickup-time order and return full `Order` objects to its callers. Preorder count and preorder screen flows will share the candidate selection rather than reading every order with details.

## Failure handling and observability

- An empty eligible-ID set returns an empty array without a detail request.
- Candidate or detail errors keep the current `{ data, error }` calling contract and show the existing screen error behavior.
- Temporary performance metrics log only query stage, duration, candidate count, eligible count, and hydrated count. They must not log order/customer payloads or credentials.
- The initial query will be supported by a migration index whose predicate matches the final non-terminal status condition. Its effectiveness must be checked with `EXPLAIN ANALYZE` in a production-like database before rollout.

## Verification

- Unit tests cover the 14-day boundary, future preorder protection, terminal exclusion, empty hydration, ID-only hydration, and ordering.
- Existing live-order eligibility and auto-print tests remain unchanged and pass.
- Manual tablet validation compares candidate/eligible/hydrated timing at a busy period and confirms a preorder card, preorder count, live transition, printing, and delivery refresh.
