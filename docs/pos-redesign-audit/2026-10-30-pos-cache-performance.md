# POS cache and rendering review

**Cache policy correction:** The initial event-filtering approach below was superseded by the explicit startup/manual-only rule. See `2026-10-30-pos-catalog-cache-policy.md`. There is now no catalogue realtime subscription, reconnect refresh, or expiry. Tile memoization, stable events, hidden-search optimization and idle-dialog optimization are retained.

## Findings

Normal category selection, product taps and add-on editing read the shared in-memory catalogue. They do not query catalogue tables or clear the catalogue. The app loads catalogue data at startup; manual refresh, a live-update reconnect, selected layout changes and relevant catalogue table events can fetch it again. Existing order editing, customer lookup, top sellers and customer-display publication have their own separate data operations.

Three avoidable work paths were found:

1. Every `products` inventory event scheduled a full catalogue refresh. Inventory stock movements update this table, while the POS source loader uses these rows only for removable ingredient names.
2. Product grid callbacks changed identity on each parent/cart render. Product tiles had no memo boundary, so all visible tiles rebuilt their colour/configuration/footer UI even when only one quantity changed.
3. Registering and unregistering a dialog host published a new global dialog snapshot even when no alert existed, notifying unrelated dialog subscribers. The hidden search sheet also rebuilt its lists during normal POS renders.

## Changes

- The snapshot records names of referenced inventory ingredients, and realtime inventory events invalidate only when those displayed names change, a referenced ingredient is removed or event metadata is insufficient. Menu products/prices, category links, add-ons, promotions and layout events still refresh normally. Startup/reconnect/manual refresh behaviour is preserved. No TTL or stale-data workaround was added.
- Product tiles are memoized, with stable ID-based dispatch shared by the category grid, Quick list, top sellers and search. A layout-effect-backed handler uses current committed cart/group state; it does not freeze old checkout or category closures. Changed product, quantity, layout and add-on props still update the tile normally.
- The search sheet avoids rendering its contents while closed. Dialog host registration stays silent while the dialog queue is empty.

## Verification

416 unit tests pass. Provider tests simulate 100 stock events with no extra catalogue refresh, then verify that ingredient renames and menu-price edits trigger refresh. Snapshot tests cover ingredient-name metadata. Grid/hook tests verify unchanged props for untouched tiles and correct dispatch through the latest handler. Existing direct-add, cart editing, catalogue cache/coordinator and payment/printing tests continue to pass. Diff check passes; full TypeScript checking retains the same 13 pre-existing receipt/caller-ID errors.

These checks establish avoided queries and render invalidation paths, not a measured frame-rate improvement on the user's tablet. Device profiling and end-to-end tablet timing remain outstanding. No live order, payment, saved configuration or physical print was changed.
