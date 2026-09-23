# POS Full Catalogue Pre-cache and Atomic Writes Design

## Goal

Keep the POS responsive during peak service by loading the complete POS catalogue once after staff access is confirmed, reading it exclusively from memory during normal POS use, and reducing order mutations to atomic database calls.

## Non-goals

- Change no POS ordering, pricing, payment, printing, marketplace-import, delivery, or staff-access business rule.
- Persist catalogue data to AsyncStorage or add time-based cache expiry.
- Retry a create-order mutation without an existing idempotency/duplicate identity.
- Treat a created on-demand delivery as provider-assigned.

## Catalogue Snapshot

`PosCatalogProvider` owns a single in-memory `PosCatalogSnapshot`. It starts after the root authentication flow has validated staff access and is mounted only while authenticated. The provider loads these source records in parallel:

- active `sale_categories`;
- active `sale_products`;
- `sale_product_addon_groups`, including active `addon_items` through their `addon_groups`;
- customer-removable `sale_product_ingredients`, including their ingredient product names;
- active `promotions` and their `promotion_products`; and
- all `pos_layouts`, normalized with the selected/default-layout resolution already used by POS.

The provider transforms the source rows into immutable read indexes: products by id and category, sorted search products, customizations by product id, customizable product ids, active promotions, and the preferred layout. The POS screen, marketplace POS import resolver, and POS layout consumers receive lookup functions/data from this snapshot instead of issuing menu queries.

Top sellers are deliberately outside the catalogue snapshot because they are a short-lived operational aggregate derived from orders, not product catalogue data. They retain their focused order/order-item invalidation path, but product lookup for their rendering comes from the snapshot.

## Lifecycle and Loading States

The provider exposes `status: 'idle' | 'loading' | 'ready' | 'refreshing' | 'error'`, `snapshot`, `lastUpdatedAt`, `error`, and `refresh(reason)`. A first load publishes no partial state: catalogue-dependent POS controls display a retryable loading/error state until one complete snapshot exists. On a later refresh, the last complete snapshot remains available with `status: 'refreshing'`; a failure changes only the error/notice state and never discards that snapshot.

There is no TTL, sweep, bounded per-key eviction, or fallback on-demand menu query. Logout clears the snapshot and stops the provider subscriptions. The existing setting named “Clear POS cache” becomes “Refresh POS catalogue” and invokes the same provider refresh path; it does not sign the user out or modify stored settings.

## Refresh and Realtime

The provider owns one Supabase Realtime channel for catalogue sources: `sale_categories`, `sale_products`, `sale_product_addon_groups`, `addon_groups`, `addon_items`, `sale_product_ingredients`, `promotions`, `promotion_products`, and `pos_layouts`. Any insert, update, or delete marks the snapshot invalid and schedules one debounced refresh. Manual refresh uses the identical coordinator.

Only one refresh may be in flight. Refresh callers share that promise; events arriving during it mark exactly one follow-up refresh. Every request receives a monotonically increasing generation. A response can publish only if it is still the newest requested generation and the provider remains mounted/authenticated. This prevents an older, slower response from overwriting a newer snapshot.

## POS Integration

`app/_layout.tsx` mounts the provider inside the authenticated application tree. `app/pos.tsx` consumes the provider rather than maintaining local category/product/customization cache state and fetch effects. Search, category selection, quick-list rendering, product customization, promotion eligibility, and layout ordering use the snapshot indexes synchronously once ready. POS is disabled only while the first snapshot is incomplete, never during a refresh that has a previous snapshot.

The manual Refresh action is visible from POS and communicates loading/failure without blocking cart editing. Existing top-seller order subscriptions remain separate. Changes made in menu management and layout settings publish through Realtime and refresh running POS tablets without a page reload.

## Atomic Order Mutations

The existing `create_pos_order_atomic(jsonb, jsonb)` remains available for backwards compatibility. A new `save_pos_order_atomic(p_order_id uuid, p_order jsonb, p_items jsonb) returns jsonb` RPC becomes the POS write path:

- `p_order_id IS NULL`: create the order, items, and add-ons.
- `p_order_id IS NOT NULL`: update the header/totals and replace its complete item/add-on graph.
- both paths validate JSON shapes, run in one PostgreSQL transaction, preserve all fields supported by `create_pos_order_atomic`, and return the hydrated order with items and add-ons.

This replaces client-side update sequencing (header update, item read, add-on delete, item delete, per-item inserts, per-item add-on inserts, read back) and removes the post-create read. The migration grants execute to `authenticated`; it is required in deployed Supabase before the app switches RPCs.

`update_pos_payment_status_atomic(p_order_id uuid, p_payment_status text, p_payment_method_detail text)` reads the current order status and applies the same status transition currently computed in TypeScript, then returns the updated order. This removes the payment read/update race without changing the transition table.

Customer resolution, delivery quotes, and terminal workflows remain sequential where they depend on the preceding result. After a successful order mutation, coupon redemption and reward persistence may run concurrently with `Promise.allSettled`; their individual failures are reported and never convert a successfully saved order into a failed checkout. Required receipt and terminal sequencing remains unchanged.

## Failure Handling

- First snapshot failure: do not show menu data; display a retry action and retain access to non-catalogue routes.
- Refresh failure with prior snapshot: retain it, display a non-blocking stale-data notice, and permit manual retry.
- Realtime disconnect: retain the snapshot and surface connection diagnostics; a successful reconnect continues the subscription. Manual refresh remains available.
- RPC failure: preserve cart/order editing state, clear the submit guard, and show the server error. Atomic rollback guarantees no partial replacement graph.
- Marketplace duplicate error and receipt-claim behavior retain their current user-visible handling.

## Tests and Verification

Unit tests cover snapshot construction, atomic complete publication, synchronous read indexes, refresh coalescing, follow-up refresh after an in-flight invalidation, stale-response suppression, first-load failure, refresh-failure retention, logout cleanup, and catalogue-table subscription coverage. POS integration tests assert menu/search/customization paths do not issue direct catalogue queries when the provider is ready.

Order tests cover new/edit RPC payloads, use of returned hydrated data, payment transition payloads, duplicate marketplace errors, and that post-save independent operations settle without losing a saved order. Migration verification runs against the local Supabase database or an equivalent isolated database before release; focused TypeScript/unit tests do not prove remote migration deployment or physical-device responsiveness.

## Rollout

1. Apply the migration before shipping client code that calls the new RPCs.
2. Release the provider and POS consumer changes together.
3. Verify a fresh login, manual refresh, menu update from another client, failed-refresh fallback, create/edit/payment flows, marketplace import, SmartPay, and kitchen/customer receipt behavior on an installed build.
