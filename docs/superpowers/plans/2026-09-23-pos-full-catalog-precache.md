# POS Full Catalogue Pre-cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve every POS catalogue read from one complete in-memory snapshot and make create/edit/payment order writes atomic and round-trip efficient.

**Architecture:** An authenticated `PosCatalogProvider` owns a complete immutable snapshot, explicit load/refresh state, and one Realtime coordinator. POS and marketplace import read its indexes. New Supabase RPCs atomically save a complete order graph and update payment status while the existing create RPC remains callable.

**Tech Stack:** Expo Router, React Native, React context, Zustand vanilla store, Supabase Realtime, PostgreSQL PL/pgSQL, TypeScript, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-23-pos-full-catalog-precache-design.md`

## Global Constraints

- Do not persist catalogue rows to AsyncStorage and do not add time-based expiry.
- Publish only complete snapshots; retain the last complete snapshot on refresh failure.
- Reload only for manual refresh or relevant Realtime changes; coalesce concurrent refresh requests.
- Preserve payment, printing, delivery, marketplace, rewards, and duplicate-import behavior.
- Keep `create_pos_order_atomic(jsonb, jsonb)` callable.
- Apply and verify the migration before release.

## Review Focus

- Realtime during a refresh must queue exactly one subsequent refresh (Task 2).
- A slow stale response must never overwrite newer data (Task 2).
- Initial-load failure blocks menu actions while later failure retains the previous menu (Tasks 2 and 4).
- A graph replacement failure rolls back order, items, and add-ons together (Task 5).
- SmartPay retry never creates a second order or changes terminal sequencing (Tasks 5 and 6).

---

### Task 1: Build pure catalogue snapshot types and indexes

**Files:**
- Create: `apps/pappas-order-management/lib/pos-catalog-snapshot.ts`
- Create: `apps/pappas-order-management/test/pos-catalog-snapshot.test.ts`
- Modify: `apps/pappas-order-management/app/pos.types.ts`

**Interfaces:**
- Produces `PosCatalogSource`, `PosCatalogSnapshot`, `buildPosCatalogSnapshot(source)`, `getProductsForCategory(snapshot, categoryIds)`, and `getProductCustomizations(snapshot, productId)`.
- Consumes POS domain types and normalized `PosLayoutRecord` from `lib/pos-layouts.ts`.

- [ ] **Step 1: Write the failing snapshot-index test**

```ts
test('builds all product and customization indexes from one source', () => {
  const snapshot = buildPosCatalogSnapshot(sourceWith({
    categories: [category('main')], products: [product('burger', 'main')],
    productAddonGroups: [productAddonGroup('burger', 'extras')],
    addonGroups: [addonGroup('extras', [addonItem('cheese')])],
    removableIngredients: [removableIngredient('burger', 'Onion')],
    promotions: [promotion('promo-1', ['burger'])], layouts: [defaultLayout('layout-1')],
  }));
  assert.deepEqual(getProductsForCategory(snapshot, ['main']).map(({ id }) => id), ['burger']);
  assert.deepEqual(getProductCustomizations(snapshot, 'burger').groups[0].items.map(({ id }) => id), ['cheese']);
  assert.equal(snapshot.customizableProductIds.has('burger'), true);
  assert.equal(snapshot.preferredLayout?.id, 'layout-1');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "builds all product"`

Expected: TypeScript reports that `pos-catalog-snapshot` does not exist.

- [ ] **Step 3: Implement the immutable builder**

```ts
export function buildPosCatalogSnapshot(source: PosCatalogSource): PosCatalogSnapshot {
  const products = source.products.filter((product) => product.is_active !== false);
  const customizationsByProductId = buildCustomizations(source.productAddonGroups, source.addonGroups, source.removableIngredients);
  return {
    categories: source.categories.filter((category) => category.is_active !== false), products,
    productsById: new Map(products.map((product) => [product.id, product])),
    productsByCategoryId: indexProductsByCategory(products),
    searchProducts: [...products].sort((a, b) => a.name.localeCompare(b.name)),
    customizationsByProductId,
    customizableProductIds: new Set([...customizationsByProductId].filter(([, value]) => value.groups.length || value.removableIngredients.length).map(([id]) => id)),
    activePromotions: normalizeActivePromotions(source.promotions),
    preferredLayout: selectPreferredLayout(source.layouts, source.selectedLayoutId),
  };
}
```

- [ ] **Step 4: Run focused tests**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "product|snapshot"`

Expected: new snapshot tests pass and existing POS type consumers compile.

- [ ] **Step 5: Commit**

Run: `git add apps/pappas-order-management/lib/pos-catalog-snapshot.ts apps/pappas-order-management/test/pos-catalog-snapshot.test.ts apps/pappas-order-management/app/pos.types.ts && git commit -m "feat: build complete POS catalog snapshot"`

### Task 2: Add the catalogue loader and serialized refresh store

**Files:**
- Create: `apps/pappas-order-management/stores/posCatalogStore.ts`
- Create: `apps/pappas-order-management/lib/pos-catalog-loader.ts`
- Create: `apps/pappas-order-management/test/pos-catalog-store.test.ts`
- Modify: `apps/pappas-order-management/stores/posCatalogCacheStore.ts`

**Interfaces:**
- Produces `PosCatalogStatus`, `createPosCatalogStore(deps)`, `loadPosCatalogSource(client, selectedLayoutId)`, and `refresh(reason)`.
- Consumes the Task 1 snapshot builder.

- [ ] **Step 1: Write failing refresh coordinator tests**

```ts
test('does not publish an old refresh after a newer one completes', async () => {
  const first = deferred<PosCatalogSource>(); const second = deferred<PosCatalogSource>();
  const store = createPosCatalogStore({ load: sequence(first.promise, second.promise) });
  const one = store.getState().refresh('startup'); const two = store.getState().refresh('manual');
  second.resolve(sourceWithProduct('new')); await two; first.resolve(sourceWithProduct('old')); await one;
  assert.equal(store.getState().snapshot?.productsById.get('new')?.name, 'new');
  assert.equal(store.getState().snapshot?.productsById.has('old'), false);
});
test('keeps the prior snapshot after a refresh error', async () => {
  const store = createPosCatalogStore({ load: sequence(Promise.resolve(sourceWithProduct('burger')), Promise.reject(new Error('offline'))) });
  await store.getState().refresh('startup'); await assert.rejects(store.getState().refresh('manual'), /offline/);
  assert.equal(store.getState().status, 'ready'); assert.equal(store.getState().snapshot?.products[0].id, 'burger');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "old refresh|prior snapshot"`

Expected: `createPosCatalogStore` is missing.

- [ ] **Step 3: Implement complete parallel source loading and generation-safe refreshes**

```ts
export async function loadPosCatalogSource(client: typeof supabase, selectedLayoutId: string | null): Promise<PosCatalogSource> {
  const [categories, products, mappings, addonGroups, ingredients, promotions, layouts] = await Promise.all([
    client.from('sale_categories').select(CATEGORY_FIELDS).eq('is_active', true).order('sort_order'),
    client.from('sale_products').select(PRODUCT_FIELDS).eq('is_active', true).order('name'),
    client.from('sale_product_addon_groups').select('sale_product_id, addon_group_id, display_order'),
    client.from('addon_groups').select('id, name, is_required, multiple_choice, addon_items(*)'),
    client.from('sale_product_ingredients').select('sale_product_id, customer_can_remove, products!product_id(name)').eq('customer_can_remove', true),
    client.from('promotions').select('*, promotion_products(sale_product_id)').eq('is_active', true),
    client.from('pos_layouts').select('id, name, layout, is_default, created_at, updated_at'),
  ]);
  throwFirstCatalogueError([categories, products, mappings, addonGroups, ingredients, promotions, layouts]);
  return mapCatalogueResults({ categories, products, mappings, addonGroups, ingredients, promotions, layouts, selectedLayoutId });
}
```

Store `inFlight`, `refreshQueued`, and a monotonic `generation`. Share an existing promise, queue one follow-up when invalidated while in-flight, and publish only when the completed request has the newest generation. A failure with no snapshot sets `status: 'error'`; with a snapshot, preserve it and set `status: 'ready'` plus `error`.

- [ ] **Step 4: Run focused tests**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "refresh|catalog"`

Expected: stale response, coalescing, first-load error, and refresh fallback tests pass.

- [ ] **Step 5: Commit**

Run: `git add apps/pappas-order-management/stores/posCatalogStore.ts apps/pappas-order-management/lib/pos-catalog-loader.ts apps/pappas-order-management/stores/posCatalogCacheStore.ts apps/pappas-order-management/test/pos-catalog-store.test.ts && git commit -m "feat: add serialized POS catalog refresh store"`

### Task 3: Mount the authenticated provider and realtime synchronisation

**Files:**
- Create: `apps/pappas-order-management/providers/PosCatalogProvider.tsx`
- Create: `apps/pappas-order-management/test/pos-catalog-provider.test.ts`
- Modify: `apps/pappas-order-management/app/_layout.tsx`

**Interfaces:**
- Produces `PosCatalogProvider`, `usePosCatalog()`, `usePosCatalogRefresh()`, and `getPosCatalogueRealtimeTables()`.
- Consumes the Task 2 store and root `authenticatedStaffAccess`.

- [ ] **Step 1: Write failing provider tests**

```ts
test('covers each catalogue table with a single refresh subscriber', () => {
  assert.deepEqual(getPosCatalogueRealtimeTables(), [
    'sale_categories', 'sale_products', 'sale_product_addon_groups', 'addon_groups', 'addon_items',
    'sale_product_ingredients', 'promotions', 'promotion_products', 'pos_layouts',
  ]);
});
test('mounts the catalogue provider inside the authenticated app tree', () => {
  assert.match(readFileSync(resolve(process.cwd(), 'app/_layout.tsx'), 'utf8'), /<PosCatalogProvider authenticated=\{authenticatedStaffAccess\}>/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "catalogue table|authenticated app tree"`

Expected: module/table helper assertions fail before provider creation.

- [ ] **Step 3: Implement the provider lifecycle**

```tsx
useEffect(() => {
  if (!authenticated) { posCatalogStore.getState().reset(); return; }
  void posCatalogStore.getState().refresh('startup');
  const channel = supabase.channel('pos-catalogue');
  for (const table of getPosCatalogueRealtimeTables()) channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh);
  channel.subscribe();
  return () => { clearScheduledRefresh(); void supabase.removeChannel(channel); };
}, [authenticated]);
```

Debounce `scheduleRefresh` and use the Task 2 store coordinator. Mount the provider around authenticated providers in `_layout.tsx`; do not create a duplicate login fetch.

- [ ] **Step 4: Run focused provider/auth tests**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "catalogue table|authenticated app tree|login"`

Expected: provider coverage and existing login tests pass.

- [ ] **Step 5: Commit**

Run: `git add apps/pappas-order-management/providers/PosCatalogProvider.tsx apps/pappas-order-management/test/pos-catalog-provider.test.ts apps/pappas-order-management/app/_layout.tsx && git commit -m "feat: preload and synchronize POS catalog"`

### Task 4: Replace lazy POS and marketplace catalogue reads

**Files:**
- Modify: `apps/pappas-order-management/app/pos.tsx`
- Modify: `apps/pappas-order-management/components/pos/PosMenuPane.tsx`
- Modify: `apps/pappas-order-management/lib/marketplace-pos-order.ts`
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx`
- Modify: `apps/pappas-order-management/test/pos-cache-settings.test.ts`
- Create: `apps/pappas-order-management/test/pos-catalog-consumers.test.ts`

**Interfaces:**
- Consumes Tasks 1–3 snapshot hooks and lookup functions.
- Produces an explicit initial load/retry state and manual `refresh('manual')` action.

- [ ] **Step 1: Write failing POS consumer tests**

```ts
test('uses a ready snapshot for search, products, and customizations', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/pos.tsx'), 'utf8');
  assert.match(source, /const \{ snapshot, status, refresh \} = usePosCatalog\(\)/);
  assert.doesNotMatch(source, /from\('sale_products'\)/);
  assert.doesNotMatch(source, /from\('sale_product_addon_groups'\)/);
  assert.doesNotMatch(source, /from\('sale_product_ingredients'\)/);
});
test('does not show actionable products before a snapshot exists', () => {
  const source = readFileSync(resolve(process.cwd(), 'app/pos.tsx'), 'utf8');
  assert.match(source, /status === 'loading' && !snapshot/); assert.match(source, /Retry catalogue load/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "ready snapshot|actionable products"`

Expected: current lazy product/customization Supabase queries violate assertions.

- [ ] **Step 3: Use only the snapshot after readiness**

```tsx
const { snapshot, status, refresh, error } = usePosCatalog();
const searchProducts = snapshot?.searchProducts ?? [];
const displayedProducts = useMemo(() => snapshot && selectedCatId ? getProductsForCategory(snapshot, categoryIds) : [], [snapshot, selectedCatId, categoryIds]);
const customizations = snapshot ? getProductCustomizations(snapshot, productId) : EMPTY_CUSTOMIZATIONS;
```

Delete TTL/sweep/per-key cache reads and every direct POS catalogue fetch. Keep editor-selection and menu-level state. Render loading/error only for `!snapshot`; display a non-blocking stale error when `snapshot && error`. Add a visible Refresh action disabled only while `status === 'refreshing'`. Change Settings from clearing cache to “Refresh POS catalogue.” Default marketplace import dependencies must use the ready snapshot and return a clear unavailable error rather than query on demand.

- [ ] **Step 4: Run focused consumer tests**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "ready snapshot|actionable products|POS cache|marketplace"`

Expected: no direct catalogue POS reads; refresh wording and marketplace matching/customization tests pass.

- [ ] **Step 5: Commit**

Run: `git add apps/pappas-order-management/app/pos.tsx apps/pappas-order-management/components/pos/PosMenuPane.tsx apps/pappas-order-management/lib/marketplace-pos-order.ts 'apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx' apps/pappas-order-management/test/pos-cache-settings.test.ts apps/pappas-order-management/test/pos-catalog-consumers.test.ts && git commit -m "refactor: serve POS catalog from memory"`

### Task 5: Add atomic order-save and payment RPCs

**Files:**
- Create: `supabase/migrations/20260923120000_save_pos_order_and_payment_atomic.sql`
- Create: `apps/pappas-order-management/test/orders-atomic-rpc.test.ts`
- Modify: `apps/pappas-order-management/lib/orders.ts`

**Interfaces:**
- Produces `save_pos_order_atomic(uuid, jsonb, jsonb) returns jsonb` and `update_pos_payment_status_atomic(uuid, text, text) returns jsonb`.
- Changes `savePosOrder`, `updatePosOrder`, and `updatePaymentStatus` to use one RPC each.

- [ ] **Step 1: Write failing RPC client contract tests**

```ts
test('saves a new order through one RPC and maps its returned graph', async () => {
  const client = fakeSupabaseRpc({ save_pos_order_atomic: { data: embeddedOrder('order-1'), error: null } });
  const result = await savePosOrderWithClient(client, orderPayload(), [orderItemWithAddon()]);
  assert.equal(result.data?.id, 'order-1');
  assert.deepEqual(client.calls[0], { name: 'save_pos_order_atomic', args: { p_order_id: null, p_order: expectNormalizedOrder(), p_items: [orderItemWithAddon()] } });
});
test('updates payment without first selecting the order', async () => {
  const client = fakeSupabaseRpc({ update_pos_payment_status_atomic: { data: embeddedOrder('order-1'), error: null } });
  await updatePaymentStatusWithClient(client, 'order-1', 'paid', 'SmartPay');
  assert.equal(client.selectCalls, 0); assert.equal(client.calls[0].name, 'update_pos_payment_status_atomic');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "one RPC|first selecting"`

Expected: client-injectable atomic save/payment functions are absent.

- [ ] **Step 3: Create transaction-safe RPCs**

```sql
CREATE FUNCTION public.save_pos_order_atomic(p_order_id uuid, p_order jsonb, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_order_id uuid;
BEGIN
  IF jsonb_typeof(p_order) IS DISTINCT FROM 'object' OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid POS order payload'; END IF;
  IF p_order_id IS NULL THEN INSERT INTO public.orders (...) VALUES (...) RETURNING id INTO v_order_id;
  ELSE UPDATE public.orders SET ... WHERE id = p_order_id RETURNING id INTO v_order_id; IF v_order_id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF; DELETE FROM public.order_items WHERE order_id = v_order_id; END IF;
  -- Insert each JSON item and nested add-on using the same fields as create_pos_order_atomic.
  RETURN public.get_pos_order_json(v_order_id);
END; $$;
```

In the migration, define `get_pos_order_json(uuid)` with `jsonb_build_object` and nested `jsonb_agg`; insert all `orders`, `order_items`, and `order_item_addons` fields currently handled by `create_pos_order_atomic`; rely on the existing cascading relationship when deleting previous item rows. Define `update_pos_payment_status_atomic` to make `pending_online_payment` become `confirmed` only when the requested payment status is `paid`, mirroring `getPaymentStatusUpdatePayload`. Grant both to `authenticated`, without replacing the legacy create function.

- [ ] **Step 4: Call one RPC per mutation**

```ts
const { data, error } = await client.rpc('save_pos_order_atomic', { p_order_id: orderId, p_order: normalizeOrderOptions(payload), p_items: items });
if (error || !data) return { data: null, error: error?.message ?? 'Failed to save POS order.' };
return { data: mapEmbeddedOrder(data as OrderWithEmbeddedItemsRow), error: null };
```

Preserve receipt-token generation and marketplace duplicate translation. Remove the edit waterfall and payment pre-read only after these RPC calls are wired.

- [ ] **Step 5: Verify focused tests and the local migration**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "RPC|SmartPay|pending order|payment"`

Expected: RPC contracts and existing SmartPay tests pass.

Run: `supabase db reset --local`

Expected: migration applies and the new functions/grants exist locally.

- [ ] **Step 6: Commit**

Run: `git add supabase/migrations/20260923120000_save_pos_order_and_payment_atomic.sql apps/pappas-order-management/lib/orders.ts apps/pappas-order-management/test/orders-atomic-rpc.test.ts && git commit -m "feat: atomically save POS order graphs"`

### Task 6: Parallelize safe post-save work and verify the whole boundary

**Files:**
- Modify: `apps/pappas-order-management/app/pos.tsx`
- Create: `apps/pappas-order-management/test/pos-post-save-operations.test.ts`
- Modify: `apps/pappas-order-management/test/pos-update-live-orders-refresh.test.ts`

**Interfaces:**
- Produces `runPostSaveOrderPersistence(orderId, customerId, coupon): Promise<PostSaveOutcome>`.
- Runs coupon and reward persistence only after a successful Task 5 RPC response.

- [ ] **Step 1: Write a failing independent-failure test**

```ts
test('keeps a saved order successful when coupon persistence fails', async () => {
  const outcome = await runPostSaveOrderPersistence({ orderId: 'order-1', customerId: 'customer-1', couponId: 'coupon-1', recordCouponRedemption: async () => { throw new Error('coupon offline'); }, applyRewardPointsForSavedOrder: async () => undefined });
  assert.equal(outcome.orderSaved, true); assert.deepEqual(outcome.failures, ['coupon offline']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "coupon persistence fails"`

Expected: helper export is absent.

- [ ] **Step 3: Implement bounded parallelism**

```ts
const results = await Promise.allSettled([couponId ? recordCouponRedemption({ couponId, orderId, userId: customerId }) : Promise.resolve(), applyRewardPointsForSavedOrder(orderId, customerId)]);
return { orderSaved: true, failures: results.flatMap((result) => result.status === 'rejected' ? [errorMessage(result.reason)] : []) };
```

Keep receipt printing and terminal operations awaited in their existing order. Surface only a post-save warning for secondary persistence failures.

- [ ] **Step 4: Run focused and full unit verification**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: report every compiler/test result. If the known printer TypeScript baseline remains, report it and run focused emitted tests; do not call that native/device/deployment verification.

- [ ] **Step 5: Verify release boundaries**

Verify on an installed build: fresh login preload, manual refresh, realtime update from another client, failed refresh fallback, create/edit/payment, marketplace import, delivery, SmartPay, and receipt paths. Confirm target Supabase migration history before release.

- [ ] **Step 6: Commit**

Run: `git add apps/pappas-order-management/app/pos.tsx apps/pappas-order-management/test/pos-update-live-orders-refresh.test.ts apps/pappas-order-management/test/pos-post-save-operations.test.ts && git commit -m "perf: keep POS responsive after atomic saves"`

## Plan Self-Review

- Spec coverage: Tasks 1–4 cover full memory preload, explicit loading, manual/realtime refresh, failure retention, and all consumer reads. Tasks 5–6 cover atomic writes, payment race removal, safe concurrency, and deployment/device boundaries.
- Placeholder scan: no deferred implementation marker remains; the SQL task explicitly preserves every current create-RPC field and nested graph.
- Type consistency: Task 1 snapshot feeds Task 2 store, Task 3 provider, and Task 4 consumers. Task 5 returns the hydrated `Order` consumed by Task 6.
- Review focus: Task 2 covers refresh races; Task 4 initial load; Task 5 atomic graph and SmartPay contracts; Task 6 post-save isolation and full verification.
