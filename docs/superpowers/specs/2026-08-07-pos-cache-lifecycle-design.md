# POS Cache Lifecycle Design

## Goal

Keep the order-management app's long-running memory footprint bounded while retaining the authenticated Supabase session and operational settings.

## Scope

The change covers only transient POS catalog data:

- categories;
- the all-products search list;
- products keyed by selected category set;
- per-product customization availability and details; and
- today's top sellers.

It does not remove AsyncStorage-backed settings, printer/device identifiers, Smartpay pairing, or the Supabase login session.

## Architecture

Replace the module-level `catalogCache` object in `app/pos.tsx` with a focused Zustand vanilla store owned by `stores/posCatalogCacheStore.ts`. The store will own every POS cache entry and expose typed reads, writes, expiry pruning, and `clearPosCatalogCache` actions. POS remains responsible for screen state and data fetching; it reads from and writes to the cache store rather than retaining a second, hidden cache implementation.

React Query remains responsible for request/query caching. Its existing five-minute garbage-collection time continues to release inactive query data. A cache-clear operation will also remove only POS query entries, never app-wide authentication or settings state.

## Lifetime and Bounds

- Categories, all products, category product lists, customization availability, and customization details expire after one hour.
- Top sellers expire after five minutes.
- Every cache read removes an expired entry before returning it.
- The POS screen continues a five-minute sweep while mounted; the sweep is cleared on unmount.
- Per-key maps use bounded least-recently-written eviction so product/category exploration cannot grow memory without limit. Limits are 24 category result sets, 300 customization availability entries, and 100 customization detail entries.
- Cache replacement and eviction release references immediately; no data is persisted to AsyncStorage.

## Settings Experience

Add a "Clear POS cache" action tile to Settings. The action:

1. explains that product/category data will be refreshed on the next POS use;
2. asks for confirmation;
3. clears the Zustand POS catalog cache and React Query entries whose keys are POS catalog-related;
4. leaves login, saved settings, printer setup, and other device configuration intact; and
5. reports success or a recoverable error.

## Testing

Unit tests will cover TTL pruning, bounded-map eviction, and full cache clearing. A Settings screen source-level test will verify that the clear action uses the centralized cleanup method and gives the user the retention guarantee. Existing POS tests must continue to pass.

## Error Handling

In-memory clearing is synchronous and should not fail in normal operation. The Settings handler still catches unexpected errors so the user receives a clear failure message rather than an unhandled rejection. POS can safely refetch when a requested entry is absent.
