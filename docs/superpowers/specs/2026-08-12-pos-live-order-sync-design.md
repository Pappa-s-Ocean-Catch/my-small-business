# POS Live Order Sync Design

## Goal

Keep the Live Orders list on every active POS terminal current after any order is created or changed on another terminal, without interrupting a staff member entering a new order. Pre-orders and historical views must fetch current data whenever their tab becomes active.

## Scope

- Add a database-owned order sync signal for all `orders` inserts, updates, and deletes.
- Subscribe active POS applications to that signal through Supabase Realtime.
- Refresh only the order-list React Query caches in response; never navigate or mutate POS-cart state.
- Reload each order-list tab when it becomes focused: Live Orders, Pre-orders, and completed/history.
- Preserve manual pull-to-refresh and existing live-order eligibility refresh behaviour.

## Architecture

The migration creates a singleton `public.order_sync_state` table with a stable primary key and an `updated_at` timestamp. An `AFTER INSERT OR UPDATE OR DELETE` trigger on `public.orders` upserts that row, setting `updated_at` with the database clock. The trigger means every origin of an order mutation is covered, including POS status/payment actions, server-side checkout/webhooks, delivery updates, and cancellations; application code cannot omit the notification.

The table is added to the `supabase_realtime` publication and has a staff-only select policy, matching the existing POS order access. Realtime updates carry a small signal only; terminals independently read the order data they are permitted to see.

The POS root layout owns one authenticated realtime subscription. It batches bursts of signals with a short debounce, then invalidates the React Query keys used by Live Orders, On the Way, and the pre-order count. Invalidation/refetch is started with `void` and is never awaited by an order mutation handler. The active New Order/cart route neither consumes these keys nor receives navigation/state updates, so it remains untouched.

Pre-orders and completed/history use focus-aware reloads. When a tab becomes active, its existing query refetches in the background so the view is current even if it was inactive during a realtime disconnect. Live Orders continues its existing scheduled eligibility refresh.

## Data Flow

1. A terminal or server action changes an `orders` row.
2. The database commits the order mutation and advances `order_sync_state.updated_at` in the same transaction.
3. Supabase Realtime sends the sync-row update to each authenticated active POS.
4. Each POS debounces the signal and invalidates only its shared order-list queries.
5. Visible order-list screens repaint with the fetched data; order entry, cart, modals, navigation, and unsaved draft state are not changed.
6. A staff member switching to Live Orders, Pre-orders, or completed/history triggers that screen's background refetch regardless of realtime state.

## Error Handling

- The sync signal is atomic with the order mutation. A failed signal write fails the transaction rather than silently creating terminal divergence.
- A realtime disconnect does not cause UI errors or navigation. Supabase reconnects normally, and focus refresh repairs any missed event.
- Background refresh failures retain the last successful list data and follow the existing query error presentation. They do not block user actions.
- Debouncing prevents a burst of multiple order updates from producing overlapping list fetches.

## Verification

- Add focused unit tests for the sync-query invalidation/debounce helper and focus-refresh behaviour.
- Add a SQL migration verification that the trigger advances the singleton state on insert, update, and delete, and that the table is in the realtime publication with staff access.
- Run the POS unit suite and TypeScript check.
- Manual two-terminal check: terminal A completes, cancels, and marks an order paid; terminal B's Live Orders changes without manual refresh and without affecting an open New Order draft. Switch terminal B through Live, Pre-orders, and history to confirm each tab refreshes on entry.
