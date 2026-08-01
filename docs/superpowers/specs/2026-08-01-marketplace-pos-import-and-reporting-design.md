# Marketplace POS Import and Reporting Design

## Goal

Make manual marketplace-to-POS imports safe and faithful to the marketplace order, while adding reliable Store, Uber Eats, and DoorDash financial reporting. The same persisted import contract will support a future automatic importer.

## Scope

This change covers marketplace orders added to POS manually today. It does not add background/automatic marketplace importing.

## Import matching

Marketplace product, add-on, ingredient, and saved mapping comparisons must use the same case-insensitive normalized representation. `tomato` and `Tomato` therefore match.

An option whose normalized name starts with `no `, `without `, `remove `, or `minus ` is a removal request. For example, `No tomato` becomes a removal of the POS ingredient `Tomato` only when that ingredient belongs to the selected sale product and has `customer_can_remove = true`.

Removal requests for ingredients that are absent, do not match, or are not removable must not be added as removals. They are retained in the existing unmatched/review workflow.

## Idempotency

Each imported marketplace order is uniquely identified by its marketplace provider and external order ID. The database must prevent duplicate third-party orders for that pair, including concurrent attempts. POS must also present a clear duplicate error before leaving an order partially created.

The uniqueness rule applies only to third-party marketplace orders, allowing non-marketplace orders to retain a null or unrelated external order number.

## Status preservation

The imported POS order reflects the marketplace order state at import time.

- Active/in-progress marketplace states import as the corresponding operational POS state (normally `confirmed`, `preparing`, or `ready`).
- Delivered/completed marketplace states import as `completed` and are report-only; they must not become a live kitchen order.
- Cancelled marketplace states import as `cancelled` and are excluded from sales reporting.
- `refunded` is added as an internal order status. Marketplace refund states import as `refunded`, are terminal/report-only, and are excluded from gross/net sales totals.

The exact provider-state mapping is isolated in one pure helper so future automatic import uses identical rules.

## Financial snapshot

At import time, POS stores immutable marketplace financial snapshot values on the `orders` row:

- Marketplace provider (`Uber Eats` or `DoorDash`, using the existing third-party source).
- Gross sales: the marketplace sale/order amount.
- Gross payout: the payout amount shown by the marketplace.

Commission is derived in reports as gross sales minus gross payout. It is not separately authoritative data.

## Reporting rules

Reports include non-cancelled, non-refunded paid orders and show a channel financial breakdown for Store, Uber Eats, and DoorDash.

For each channel, report order count, gross sales, gross payout, commission, and net sales:

- Store gross sales is the POS order total; gross payout is not applicable; net sales is `gross sales × 0.90`.
- Uber Eats and DoorDash gross sales is the stored marketplace gross-sales snapshot; gross payout is the stored marketplace payout snapshot; commission is gross sales minus gross payout; net sales is `gross payout × 0.90`.

The headline/series sales total and existing trend charts remain gross-sales based. The new table supplies gross payout, commission, and net-sales visibility without changing the meaning of existing gross sales figures.

## Data and compatibility

A Supabase migration adds nullable financial snapshot columns and expands the order-status constraint to include `refunded`. Existing orders remain valid. Imported orders without a payout snapshot remain reportable using their stored total as gross sales; gross payout, commission, and net sales are shown as unavailable rather than fabricated.

## Verification

Tests cover normalized removal matching and the removable flag, case-insensitive matching, status mapping, report metrics by channel, and duplicate-order enforcement/error handling. Type-checking and the affected test suite must pass.
