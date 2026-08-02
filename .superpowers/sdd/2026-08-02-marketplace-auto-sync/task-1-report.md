# Task 1: Extend lifecycle/status support

## Changes

- Added the `on_the_way` POS order status to the shared order type, POS status color/label maps, and a new database constraint migration.
- Extended `getMarketplaceOrderStatus(state, description, timeline?)` to normalize direct state, description, and marketplace timeline fields.
- Mapped picked up, en route, on the way, and out for delivery to `on_the_way`.
- Preserved terminal precedence: refunded and cancelled override transit states; completed/delivered overrides transit states.

## TDD evidence

- RED: lifecycle tests initially failed with `confirmed` instead of `on_the_way`; the timeline terminal-state test also failed because timeline was ignored.
- RED: the focused `out for delivery` regression initially returned `completed` because the prior completed match treated `delivery` as delivered.
- GREEN: narrowed the completed match to `delivered`, then the full unit suite passed.

## Verification

- `pnpm --filter pappas-order-management test:unit` — 26 passing, 0 failing.
- `git diff --check` — clean.
