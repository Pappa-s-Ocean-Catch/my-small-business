# Desktop POS Live Orders and Printing Design

## Goal

Extend the Tauri desktop POS from a new-order workspace into an operational
staff console. The first complete workflow is Live Orders with detail and
status actions. Printing follows through the same order-detail boundary.

## Constraints

- Keep the Expo POS unchanged.
- Use the existing Supabase order schema, atomic order APIs, and staff RLS.
- Preserve the mobile Live Orders eligibility contract: exclude completed,
  cancelled, refunded, on-the-way, and pending online-payment orders; include
  scheduled pickups only when they are due within 30 minutes.
- Work on `main`; leave changes uncommitted.
- Do not store Supabase credentials or sessions in browser storage. When the
  native keychain is unavailable, the desktop app may use a memory-only session.

## Workspace

The authenticated desktop shell gains an Orders workspace alongside New Order.
Live Orders is the default Orders view. History is a later tab in the same
workspace, not a separate disconnected screen.

The Live Orders queue is one chronological, ungrouped list. A row displays the
order number, age or pickup time, source/channel, payment state, customer name,
total, and a status badge. Empty, initial-load, stale-refresh, and retryable
error states are explicit.

## Data and Realtime

A desktop order gateway reads candidate rows for the current Live Orders window
and hydrates their complete order details. The initial request and every
manual/realtime refresh replace only the order-list state; they never mutate the
new-order cart.

The app subscribes to `order_sync_state` and debounces queue invalidation. It
does not subscribe broadly to all order rows or make cart state depend on
realtime. Closing the workspace unsubscribes cleanly.

## Detail and Actions

Clicking a queue row fetches the authoritative complete order and opens a detail
drawer. The drawer shows line items, add-ons, removed ingredients, comments,
customer/pickup/delivery fields, totals, payment state, and order status.

Confirm, Ready, Complete, and Cancel are explicit actions. Each action locks
only its selected order while pending, uses the existing order status API/RPC,
then refreshes the affected detail and queue. Errors remain visible and leave
the previous authoritative state intact.

## Printing

Printing is added after Live Orders actions are stable. The detail drawer owns
the user initiation point. It loads the current order before preparing a job,
uses the existing receipt/kitchen document contract, and does not clear or retry
an already-persisted order because a print attempt fails.

Only paid cash/card orders are eligible for automatic printing. Manual
reprints retain their existing safeguards and clearly report unavailable desktop
printer transport until the Tauri print adapter is implemented.

## Testing

Unit tests cover Live Orders eligibility, ordering, stale/realtime refresh
suppression, status-action duplicate prevention, and detail rendering. Renderer
tests cover loading, error, empty, queue, and per-order pending states. The
desktop production build and targeted Rust checks validate packaging boundaries.

Expo test failures are reported separately if the known native-printer baseline
still blocks its full suite.
