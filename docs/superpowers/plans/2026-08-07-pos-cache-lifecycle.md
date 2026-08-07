# POS Cache Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound and centrally manage transient POS catalog cache memory, provide an in-app cleanup action, and retain authentication plus device configuration.

**Architecture:** A focused vanilla Zustand store owns transient POS catalog entries, TTL pruning, bounded map insertion, and complete invalidation. `app/pos.tsx` delegates every catalog-cache read/write to this store and retains only screen-local state. Settings invokes the store action after confirmation; no AsyncStorage keys, Supabase session, or operational settings are cleared.

**Tech Stack:** Expo/React Native, TypeScript, Zustand, React Native Paper, Node test runner.

## Global Constraints

- Retain Supabase authentication, app settings, saved printers, device ID, and Smartpay pairing.
- Do not persist POS catalog cache entries to AsyncStorage.
- Cache TTLs: one hour for catalog entries; five minutes for top sellers.
- Bound maps to 24 category result sets, 300 availability records, and 100 customization-detail records.
- Clearing the cache must release all POS catalog references and cause later POS loads to refetch.

---

### Task 1: Create the bounded POS catalog cache store

**Files:**

- Create: `apps/pappas-order-management/stores/posCatalogCacheStore.ts`
- Create: `apps/pappas-order-management/test/pos-catalog-cache-store.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**

- Consumes: `CacheEntry`, `SaleCategory`, `SaleProduct`, `CustomizationData`, and `TopSellerProduct` from `app/pos.types.ts`.
- Produces: `posCatalogCacheStore` with `getCategories`, `setCategories`, `getAllProducts`, `setAllProducts`, `getProductsByCategory`, `setProductsByCategory`, `getCustomizationAvailability`, `setCustomizationAvailability`, `getCustomization`, `setCustomization`, `getTopSellers`, `setTopSellers`, `clearTopSellers`, `clear`, and `pruneExpired`.

- [ ] **Step 1: Write the failing store tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createPosCatalogCacheStore } from '../stores/posCatalogCacheStore';

test('prunes expired data on read and explicit sweeps', () => {
  let now = 1_000;
  const cache = createPosCatalogCacheStore({ now: () => now });
  cache.setCategories([{ id: 'c1' } as any], 10);
  assert.equal(cache.getCategories()?.[0].id, 'c1');
  now = 1_010;
  assert.equal(cache.getCategories(), null);
});

test('evicts the oldest map entry once its limit is reached', () => {
  const cache = createPosCatalogCacheStore({ categoryLimit: 2 });
  cache.setProductsByCategory('a', []);
  cache.setProductsByCategory('b', []);
  cache.setProductsByCategory('c', []);
  assert.equal(cache.getProductsByCategory('a'), null);
  assert.deepEqual(cache.getProductsByCategory('c'), []);
});

test('clear releases every transient POS cache reference', () => {
  const cache = createPosCatalogCacheStore();
  cache.setCategories([{ id: 'c1' } as any]);
  cache.setCustomization('p1', { groups: [], removableIngredients: [] });
  cache.clear();
  assert.equal(cache.getCategories(), null);
  assert.equal(cache.getCustomization('p1'), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: TypeScript fails because `posCatalogCacheStore` does not exist.

- [ ] **Step 3: Implement the store with expiry and bounds**

```ts
export const CATALOG_CACHE_TTL_MS = 60 * 60 * 1000;
export const TOP_SELLERS_CACHE_TTL_MS = 5 * 60 * 1000;

const readFresh = <T>(entry: CacheEntry<T> | null, now: number) => (
  entry && entry.expiresAt > now ? entry.data : null
);

const setBounded = <T>(map: Map<string, CacheEntry<T>>, key: string, entry: CacheEntry<T>, limit: number) => {
  map.delete(key);
  map.set(key, entry);
  while (map.size > limit) map.delete(map.keys().next().value!);
};
```

Implement all declared methods around this behavior. `get*` methods delete stale map values before returning `null`; `pruneExpired` nulls expired scalar entries and removes stale map entries; `clear` nulls scalar entries and calls `.clear()` on every map.

- [ ] **Step 4: Include the store in the unit-test TypeScript program and run tests**

Add `stores/posCatalogCacheStore.ts` to `tsconfig.test.json` `include`, then run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pappas-order-management/stores/posCatalogCacheStore.ts apps/pappas-order-management/test/pos-catalog-cache-store.test.ts apps/pappas-order-management/tsconfig.test.json
git commit -m "feat(pos): centralize bounded catalog cache"
```

### Task 2: Migrate POS data loading to the centralized cache

**Files:**

- Modify: `apps/pappas-order-management/app/pos.tsx:77-137,391-1433`
- Test: `apps/pappas-order-management/test/pos-catalog-cache-store.test.ts`

**Interfaces:**

- Consumes: `posCatalogCacheStore` from Task 1.
- Produces: POS screen behavior that has no module-level catalog `Map` or cache-entry helpers.

- [ ] **Step 1: Extend the failing test with global-store reset coverage**

```ts
import { posCatalogCacheStore } from '../stores/posCatalogCacheStore';

test('global cache clear makes future POS reads miss', () => {
  posCatalogCacheStore.clear();
  posCatalogCacheStore.setAllProducts([{ id: 'p1' } as any]);
  posCatalogCacheStore.clear();
  assert.equal(posCatalogCacheStore.getAllProducts(), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL until the exported global store exists.

- [ ] **Step 3: Replace local cache helpers and all POS call sites**

Remove `catalogCache`, `isCacheFresh`, `cacheEntry`, `getFreshCacheEntry`, `pruneExpiredCacheEntries`, and `pruneCatalogCache` from `pos.tsx`. Import the store and replace every category, product, top-seller, availability, and customization cache read/write with its matching `get*`/`set*` method. Keep `POS_CACHE_SWEEP_INTERVAL_MS`; its effect calls `posCatalogCacheStore.pruneExpired()` and returns `clearInterval(sweepTimer)`.

Preserve the existing sale-completion invalidation by replacing the top-seller assignment with `posCatalogCacheStore.clearTopSellers()`, so a sale refreshes that result without discarding the full catalog.

- [ ] **Step 4: Run unit tests and TypeScript checks**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS. Also run `pnpm --filter pappas-order-management exec tsc --noEmit` and resolve any cache API type mismatches.

- [ ] **Step 5: Commit**

```bash
git add apps/pappas-order-management/app/pos.tsx apps/pappas-order-management/test/pos-catalog-cache-store.test.ts
git commit -m "refactor(pos): use catalog cache store"
```

### Task 3: Add the safe Settings cleanup action

**Files:**

- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx:1-230,588-668`
- Create: `apps/pappas-order-management/test/pos-cache-settings.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**

- Consumes: `posCatalogCacheStore.clear()` from Task 1.
- Produces: a confirmation-backed `handleClearPosCache` handler and a Settings action tile.

- [ ] **Step 1: Write the failing Settings source test**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Settings clears only transient POS catalog cache after confirmation', () => {
  const source = readFileSync(new URL('../../../../apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ posCatalogCacheStore \} from '@\/stores\/posCatalogCacheStore';/);
  assert.match(source, /'Clear POS cache\?'/);
  assert.match(source, /posCatalogCacheStore\.clear\(\)/);
  assert.match(source, /keeps you signed in/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: FAIL because Settings has no POS-cache action.

- [ ] **Step 3: Implement the confirmation and action tile**

Import `posCatalogCacheStore`. Add `handleClearPosCache`, following `handleClearJournal`'s Alert pattern:

```ts
Alert.alert(
  'Clear POS cache?',
  'This removes cached categories, products, and customizations. They will refresh next time you use POS. This keeps you signed in and does not change your settings.',
  [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Clear POS cache',
      style: 'destructive',
      onPress: () => {
        posCatalogCacheStore.clear();
        Alert.alert('POS cache cleared', 'Product data will refresh when you next open POS.');
      },
    },
  ],
);
```

Add a `SettingsSectionCard` titled `Storage` immediately after `Catalog`, with a `SettingsActionTile` titled `Clear POS cache`, description `Remove cached categories, products, and customizations`, icon `database-remove-outline`, and `onPress={handleClearPosCache}`.

- [ ] **Step 4: Run focused and full checks**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS. Then run `pnpm --filter pappas-order-management exec tsc --noEmit` and verify Settings compiles with the icon and cache-store import.

- [ ] **Step 5: Commit**

```bash
git add apps/pappas-order-management/app/'(drawer)'/'(tabs)'/settings.tsx apps/pappas-order-management/test/pos-cache-settings.test.ts apps/pappas-order-management/tsconfig.test.json
git commit -m "feat(settings): add POS cache cleanup"
```

### Task 4: Verify long-running lifecycle behavior

**Files:**

- Verify: `apps/pappas-order-management/stores/posCatalogCacheStore.ts`
- Verify: `apps/pappas-order-management/app/pos.tsx`
- Verify: `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx`

**Interfaces:**

- Consumes: completed Tasks 1-3.
- Produces: verified bounded and disposable POS cache behavior.

- [ ] **Step 1: Run the full automated suite**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS with all existing and new tests.

- [ ] **Step 2: Run app type checking**

Run: `pnpm --filter pappas-order-management exec tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Perform the manual lifecycle check**

Open POS, load categories/products and a customized item, then return to Settings. Confirm `Clear POS cache`, accept the prompt, reopen POS, and confirm catalog data reloads. Confirm the current user remains signed in and printer/settings values are unchanged.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --check HEAD` and `git status --short`.

Expected: no whitespace errors; only the planned POS cache, Settings, test, and TypeScript configuration files are changed.
