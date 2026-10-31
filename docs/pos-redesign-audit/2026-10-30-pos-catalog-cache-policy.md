# POS catalogue cache policy restored

The required policy is load-on-startup, no catalogue expiry, and explicit staff reload only. The review found that realtime table updates and reconnects still refreshed the full catalogue; the legacy cache also had a one-hour default, and layout Save/Apply refetched catalogue sources. Those paths violated the rule even though individual product taps did not query catalogue tables.

## Current behaviour

- The authenticated app session loads the catalogue immediately once. Startup/remount requests reuse that snapshot and never retry a failed startup implicitly. The existing Retry/Refresh controls are explicit manual actions.
- The catalogue provider has no database subscription, reconnect handler, timer or delayed refresh. Its coordinator only accepts startup and manual refresh, including a runtime guard against old realtime/selection callers.
- Items, categories and customization cache entries do not expire, even after pruning. Top-seller statistics retain their separate expiry policy because they are dynamic sales aggregates.
- Layout Apply writes the chosen local record and updates only cached layout metadata. Saving a named layout updates the cached layouts list without changing the live applied layout or reloading catalogue sources. Product and customization object references remain intact.
- A manual reload replaces the snapshot only after a complete successful fetch. Failed reloads retain the prior catalogue. Signing out clears the private session cache; restarting the app starts a new load.

The earlier inventory-event filtering optimization was removed because the correct rule is no background catalogue refresh at all. Product tile memoization, stable callbacks, hidden-search rendering and idle-dialog notification optimizations remain.

## Verification

417 unit tests pass. Tests cover repeated startup reuse, manual force reload/coalescing, failed load/reload handling, logout invalidation, absence of provider timers/subscriptions, local layout application without loader calls, runtime rejection of background refresh reasons, and non-expiring category/product/add-on entries after a simulated year and pruning. Diff check passes; full TypeScript checking retains 13 existing receipt/caller-ID errors with no new errors.

No live data, payments, saved layouts or physical printers were changed during verification. Device frame-time profiling remains separate from this cache-policy correction.
