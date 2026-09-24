# Pappas POS Desktop Tauri Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a macOS and Windows Tauri desktop POS vertical slice: staff sign-in, secure desktop session, complete catalogue hydration, cart/customisation, cash/card order creation, and Realtime synchronization with the existing POS.

**Architecture:** Keep business rules and backend contracts platform-neutral in a new workspace package, then adapt them in both the existing Expo POS and a new React/Vite/Tauri desktop app. The desktop renderer talks to Supabase for authorized data and to a least-privilege Rust backend only for secure session storage and desktop lifecycle; it does not receive arbitrary filesystem, process, or socket permissions.

**Tech Stack:** pnpm workspaces, TypeScript, React 19, Vite, Tauri v2, Rust, Supabase JS v2, React Router, TanStack Query, Vitest, Tauri command tests, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-24-pos-desktop-tauri-design.md`

## Global Constraints

- The desktop app runs alongside the Expo Android/iOS POS; do not convert or retire the Expo app.
- Preserve all existing order, pricing, promotion, payment, marketplace, delivery, staff authorization, and POS Mirror business rules.
- The first desktop release is online-first: never claim an order, payment, or print completed while the authoritative backend is unavailable.
- Catalogue data is hydrated after authenticated staff access, publishes only complete snapshots, and retains its last complete snapshot when a later refresh fails.
- Shared domain packages must not import React Native, Expo, Tauri, DOM globals, or a storage/network implementation.
- Desktop register IDs use the existing SmartPay register-ID semantics but are unique to each desktop installation.
- POS Mirror publication and optional background capabilities are fail-open and must not block cart, checkout, persistence, or navigation.
- Production renderer code has no arbitrary filesystem, subprocess, or network-socket access; privileged Tauri commands validate every input.
- This plan does not add printer, SmartPay terminal, caller-ID, offline-queue, installer-signing, or full operational-parity code; those are sequenced in successor plans.

## Review Focus

- A desktop session whose secure-store read is malformed or unavailable must return signed-out state and must not crash initial rendering (Task 5).
- A catalogue request that completes after logout, or after a newer manual refresh, must never publish its stale result (Task 6).
- An authorized desktop user with an empty catalogue must see an explicit empty state rather than an endless spinner or an actionable stale menu (Task 7).
- A double click or keyboard repeat on cash/card checkout must make one atomic save request, with the second action disabled until the first settles (Task 9).
- A POS Mirror upsert failure or Realtime reconnect must be visible diagnostically but must not prevent an order cart from changing or saving (Task 10).

---

## File Structure

| Path | Responsibility |
|---|---|
| `libs/pos-domain/` | Pure POS contracts and functions shared by mobile and desktop; no UI or platform imports. |
| `apps/pappas-order-management/lib/` | Expo adapters that preserve current mobile behavior while consuming extracted contracts. |
| `apps/pappas-order-management-desktop/src/platform/` | Renderer-side typed wrappers for the narrow Tauri commands and desktop session state. |
| `apps/pappas-order-management-desktop/src/features/` | Desktop UI features: login, catalogue, cart, checkout, and Live Orders. |
| `apps/pappas-order-management-desktop/src-tauri/` | Rust command implementations, capabilities, and Tauri configuration. |
| `apps/pappas-order-management-desktop/test/` | Desktop unit/component contracts and end-to-end smoke fixtures. |

## Task 1: Establish a platform-neutral POS-domain workspace package

**Files:**
- Create: `libs/pos-domain/package.json`
- Create: `libs/pos-domain/tsconfig.json`
- Create: `libs/pos-domain/src/index.ts`
- Create: `libs/pos-domain/src/platform-services.ts`
- Create: `libs/pos-domain/src/platform-services.test.ts`
- Modify: `pnpm-workspace.yaml`

**Interfaces:**
- Produces `@my-small-business/pos-domain`.
- Produces `PlatformResult<T>`, `PosSecureStore`, `PosPrinterService`, `PosNotificationService`, `PosFileService`, `PosCallerIdService`, and `PosPlatformServices`.
- Consumes no Expo, React Native, React, Tauri, DOM, Supabase, or Node runtime modules.

- [ ] **Step 1: Write the failing platform-boundary tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('pos-domain exposes typed platform services without runtime dependencies', () => {
  const source = readFileSync(new URL('./platform-services.ts', import.meta.url), 'utf8');
  assert.match(source, /export type PosPlatformServices/);
  assert.doesNotMatch(source, /react-native|expo-|@tauri-apps|window\.|document\.|from 'node:/);
});
```

- [ ] **Step 2: Run the boundary test to verify it fails**

Run: `node --test libs/pos-domain/src/platform-services.test.ts`

Expected: FAIL because the package and test target do not exist.

- [ ] **Step 3: Create the package and service contracts**

```ts
export type PlatformResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

export type PosSecureStore = {
  get(key: 'supabase-session' | 'register-id' | 'register-name'): Promise<PlatformResult<string | null>>;
  set(key: 'supabase-session' | 'register-id' | 'register-name', value: string): Promise<PlatformResult<void>>;
  remove(key: 'supabase-session'): Promise<PlatformResult<void>>;
};

export type PosPrinterService = { readonly kind: 'unsupported' | 'raw-tcp'; print(): Promise<PlatformResult<void>> };
export type PosNotificationService = { notify(input: { title: string; body: string }): Promise<PlatformResult<void>> };
export type PosFileService = { exportJson(input: { suggestedName: string; json: string }): Promise<PlatformResult<void>> };
export type PosCallerIdService = { readonly supported: boolean };
export type PosPlatformServices = { secureStore: PosSecureStore; printer: PosPrinterService; notifications: PosNotificationService; files: PosFileService; callerId: PosCallerIdService };
```

Export these types from `src/index.ts`, add the package name/version/scripts, and leave `pnpm-workspace.yaml` unchanged if its existing `libs/*` glob already includes the new package.

- [ ] **Step 4: Run package and boundary tests**

Run: `pnpm --filter @my-small-business/pos-domain exec tsc --noEmit && node --test libs/pos-domain/src/platform-services.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the package boundary**

Run: `git add libs/pos-domain pnpm-workspace.yaml && git commit -m "feat: add platform-neutral POS domain contracts"`

## Task 2: Extract portable catalogue and register identity contracts

**Files:**
- Create: `libs/pos-domain/src/catalog.ts`
- Create: `libs/pos-domain/src/register.ts`
- Create: `libs/pos-domain/src/catalog.test.ts`
- Create: `libs/pos-domain/src/register.test.ts`
- Modify: `libs/pos-domain/src/index.ts`
- Modify: `apps/pappas-order-management/lib/pos-catalog-snapshot.ts`
- Modify: `apps/pappas-order-management/lib/pos-catalog-loader.ts`
- Modify: `apps/pappas-order-management/lib/smartpay.ts`

**Interfaces:**
- Produces `buildCatalogSnapshot(source)`, `productsForCategories(snapshot, categoryIds)`, `createRegisterId(randomUuid)`, and `normalizeRegisterName(value)`.
- Consumes raw catalogue records as generic TypeScript types and a caller-injected `loadCatalogSource` function; no Supabase client is imported by `catalog.ts`.
- Existing Expo modules consume the shared implementations through compatibility re-exports.

- [ ] **Step 1: Write failing cross-platform catalogue and register tests**

```ts
test('builds identical category indexes for any injected catalogue source', () => {
  const snapshot = buildCatalogSnapshot({ categories: [category('main')], products: [product('burger', 'main')], addonLinks: [], ingredients: [], promotions: [], layouts: [], selectedLayoutId: null });
  assert.deepEqual(productsForCategories(snapshot, ['main']).map((item) => item.id), ['burger']);
});

test('uses injected UUID generation and normalizes desktop register names', () => {
  assert.equal(createRegisterId(() => 'desktop-register-1'), 'desktop-register-1');
  assert.equal(normalizeRegisterName('  Front counter  '), 'Front counter');
  assert.equal(normalizeRegisterName('   '), 'Desktop Register');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test libs/pos-domain/src/catalog.test.ts libs/pos-domain/src/register.test.ts`

Expected: FAIL because the functions are not exported.

- [ ] **Step 3: Move only pure logic into `pos-domain`**

```ts
export function createRegisterId(randomUuid: () => string): string { return randomUuid(); }
export function normalizeRegisterName(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized || 'Desktop Register';
}

export function buildCatalogSnapshot(source: CatalogSource): CatalogSnapshot {
  const activeProducts = source.products.filter((product) => product.is_active !== false);
  return { ...buildIndexes(activeProducts, source), products: activeProducts };
}
```

Move the implementation currently in `pos-catalog-snapshot.ts` without changing its observable sorting/customization behavior. Change `loadPosCatalogSource` to accept `client` and `loadSelectedLayoutId` parameters; retain an Expo wrapper that passes the existing `supabase` and AsyncStorage layout setting. Replace `smartpay.ts`’s private ID/name normalization helpers with the new exports but retain the current mobile AsyncStorage persistence.

- [ ] **Step 4: Run shared and existing focused tests**

Run: `node --test libs/pos-domain/src/catalog.test.ts libs/pos-domain/src/register.test.ts && pnpm --filter pappas-order-management test:unit -- --test-name-pattern "catalog|SmartPay|register"`

Expected: PASS; report the known unrelated full-suite printer/type baseline separately if it prevents the broad command from starting tests.

- [ ] **Step 5: Commit the extracted portable contracts**

Run: `git add libs/pos-domain apps/pappas-order-management/lib/pos-catalog-snapshot.ts apps/pappas-order-management/lib/pos-catalog-loader.ts apps/pappas-order-management/lib/smartpay.ts && git commit -m "refactor: share POS catalog and register contracts"`

## Task 3: Create a dependency-injected Supabase POS gateway

**Files:**
- Create: `libs/pos-domain/src/pos-gateway.ts`
- Create: `libs/pos-domain/src/pos-gateway.test.ts`
- Modify: `libs/pos-domain/src/index.ts`
- Modify: `apps/pappas-order-management/lib/orders.ts`
- Modify: `apps/pappas-order-management/lib/pos-catalog-loader.ts`

**Interfaces:**
- Produces `PosGateway`, `loadCompleteCatalog(gateway)`, and `saveInstoreOrder(gateway, input)`.
- `PosGateway` exposes only `loadCatalog`, `saveOrder`, and `subscribe` operations needed by app layers; it never exposes a service-role client.
- Existing mobile functions retain their public call signatures and delegate to a gateway created from the existing Supabase client.

- [ ] **Step 1: Write failing gateway contract tests**

```ts
test('does not issue a partial catalogue result when one source fails', async () => {
  const gateway = fakeGateway({ categories: ok([category('main')]), products: fail('network down') });
  await assert.rejects(loadCompleteCatalog(gateway), /network down/);
});

test('saves an in-store order through one named atomic operation', async () => {
  const gateway = fakeGateway({ saveOrder: ok(savedOrder('order-1')) });
  const result = await saveInstoreOrder(gateway, validInstoreOrder());
  assert.equal(result.id, 'order-1');
  assert.deepEqual(gateway.calls, [{ name: 'save_pos_order_atomic', orderId: null }]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test libs/pos-domain/src/pos-gateway.test.ts`

Expected: FAIL because `PosGateway`, `loadCompleteCatalog`, and `saveInstoreOrder` do not exist.

- [ ] **Step 3: Implement the narrow gateway**

```ts
export type PosGateway = {
  loadCatalog(): Promise<CatalogSource>;
  saveOrder(input: { orderId: string | null; order: Record<string, unknown>; items: unknown[] }): Promise<SavedOrder>;
};

export async function loadCompleteCatalog(gateway: PosGateway): Promise<CatalogSnapshot> {
  return buildCatalogSnapshot(await gateway.loadCatalog());
}
```

Create `createSupabasePosGateway(client, selectedLayoutId)` in the mobile adapter. It must await every source query/paginated source before returning a `CatalogSource`, map Supabase errors to `Error`, and use `save_pos_order_atomic` only after its migration has been deployed. Until that deployment is verified, retain the existing `orders.ts` call path and flag the gateway atomic-save switch behind an explicit `atomicSaveEnabled` dependency.

- [ ] **Step 4: Run focused gateway and mobile compatibility tests**

Run: `node --test libs/pos-domain/src/pos-gateway.test.ts && pnpm --filter pappas-order-management test:unit -- --test-name-pattern "atomic|catalog|save order"`

Expected: PASS; no existing mobile checkout behavior changes before the atomic migration is available.

- [ ] **Step 5: Commit the POS data gateway**

Run: `git add libs/pos-domain apps/pappas-order-management/lib/orders.ts apps/pappas-order-management/lib/pos-catalog-loader.ts && git commit -m "refactor: add injectable POS data gateway"`

## Task 4: Scaffold the Tauri desktop workspace and test harness

**Files:**
- Create: `apps/pappas-order-management-desktop/package.json`
- Create: `apps/pappas-order-management-desktop/tsconfig.json`
- Create: `apps/pappas-order-management-desktop/vite.config.ts`
- Create: `apps/pappas-order-management-desktop/index.html`
- Create: `apps/pappas-order-management-desktop/src/main.tsx`
- Create: `apps/pappas-order-management-desktop/src/App.tsx`
- Create: `apps/pappas-order-management-desktop/src/App.test.tsx`
- Create: `apps/pappas-order-management-desktop/src-tauri/Cargo.toml`
- Create: `apps/pappas-order-management-desktop/src-tauri/tauri.conf.json`
- Create: `apps/pappas-order-management-desktop/src-tauri/src/main.rs`
- Create: `apps/pappas-order-management-desktop/src-tauri/capabilities/default.json`
- Modify: `package.json`

**Interfaces:**
- Produces `pappas-order-management-desktop` workspace scripts: `dev`, `build`, `test`, `tauri:dev`, and `tauri:build`.
- Produces a renderer `<App />` that can run in a browser test environment and a Tauri desktop window.
- The initial capability file permits only app-local commands defined in Task 5; no filesystem, shell, process, HTTP, or raw-socket Tauri plugin permission is granted.

- [ ] **Step 1: Write the failing desktop shell tests**

```tsx
it('renders a desktop POS loading shell', () => {
  render(<App />);
  expect(screen.getByRole('status')).toHaveTextContent('Starting Pappas POS');
});

it('does not expose unscoped Tauri plugin permissions', () => {
  const capability = readFileSync(new URL('../src-tauri/capabilities/default.json', import.meta.url), 'utf8');
  expect(capability).not.toMatch(/fs:default|shell:default|process:default|http:default/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter pappas-order-management-desktop test -- --run src/App.test.tsx`

Expected: FAIL because the desktop package does not exist.

- [ ] **Step 3: Create the minimal desktop shell**

```tsx
export function App() {
  return <main aria-busy="true"><p role="status">Starting Pappas POS</p></main>;
}
```

Configure Vite with React and the `@my-small-business/pos-domain` workspace dependency. Configure Tauri `frontendDist` to `../dist`, `devUrl` to the Vite server, a product name of `Pappas POS`, and a single `main` window with a safe minimum width/height. `main.rs` must only run `tauri::Builder::default().run(tauri::generate_context!())` at this stage.

- [ ] **Step 4: Run renderer and Tauri compile checks**

Run: `pnpm --filter pappas-order-management-desktop test -- --run src/App.test.tsx && pnpm --filter pappas-order-management-desktop build && cargo check --manifest-path apps/pappas-order-management-desktop/src-tauri/Cargo.toml`

Expected: PASS.

- [ ] **Step 5: Commit the desktop shell**

Run: `git add apps/pappas-order-management-desktop package.json pnpm-lock.yaml && git commit -m "feat: scaffold Tauri desktop POS shell"`

## Task 5: Add scoped desktop secure-session and register storage

**Files:**
- Create: `apps/pappas-order-management-desktop/src-tauri/src/secure_store.rs`
- Create: `apps/pappas-order-management-desktop/src-tauri/src/commands.rs`
- Create: `apps/pappas-order-management-desktop/src-tauri/src/secure_store_test.rs`
- Modify: `apps/pappas-order-management-desktop/src-tauri/src/main.rs`
- Modify: `apps/pappas-order-management-desktop/src-tauri/Cargo.toml`
- Modify: `apps/pappas-order-management-desktop/src-tauri/capabilities/default.json`
- Create: `apps/pappas-order-management-desktop/src/platform/secure-store.ts`
- Create: `apps/pappas-order-management-desktop/src/platform/secure-store.test.ts`

**Interfaces:**
- Produces Tauri commands `session_get`, `session_set`, `session_clear`, `register_get`, and `register_set`.
- Produces `createDesktopSecureStore(invoke): PosSecureStore`.
- Command keys are fixed; no command accepts a caller-supplied path or arbitrary key name.

- [ ] **Step 1: Write failing renderer and Rust storage tests**

```ts
it('returns a typed signed-out result when the secure store is unavailable', async () => {
  const store = createDesktopSecureStore(async () => { throw new Error('keychain unavailable'); });
  await expect(store.get('supabase-session')).resolves.toEqual({ ok: false, code: 'SECURE_STORE_UNAVAILABLE', message: 'Secure storage is unavailable on this computer.' });
});
```

```rust
#[test]
fn rejects_unknown_storage_key() {
    assert!(StorageKey::try_from("../../session").is_err());
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter pappas-order-management-desktop test -- --run src/platform/secure-store.test.ts && cargo test --manifest-path apps/pappas-order-management-desktop/src-tauri/Cargo.toml secure_store`

Expected: FAIL because commands and adapters are absent.

- [ ] **Step 3: Implement fixed-key OS secure storage**

```rust
enum StorageKey { SupabaseSession, RegisterId, RegisterName }
impl TryFrom<&str> for StorageKey { /* match only the three exact keys */ }

#[tauri::command]
fn session_get(state: tauri::State<SecureStore>) -> Result<Option<String>, StoreError> {
    state.get(StorageKey::SupabaseSession)
}
```

Use a Rust OS-keychain/keyring implementation keyed by application identifier and fixed `StorageKey`. `session_set` refuses empty strings; `register_set` validates a UUID-like register ID and a trimmed name of 1–80 characters. Map OS failures to the redacted `SECURE_STORE_UNAVAILABLE` error. Register only these commands in `invoke_handler`, then list only these command permissions in the capability file.

```ts
export function createDesktopSecureStore(invoke: Invoke): PosSecureStore {
  return { get: async (key) => callString(invoke, keyToGetCommand[key]), set: async (key, value) => callVoid(invoke, keyToSetCommand[key], { value }), remove: async () => callVoid(invoke, 'session_clear') };
}
```

- [ ] **Step 4: Run focused secure-storage verification**

Run: `pnpm --filter pappas-order-management-desktop test -- --run src/platform/secure-store.test.ts && cargo test --manifest-path apps/pappas-order-management-desktop/src-tauri/Cargo.toml secure_store && cargo clippy --manifest-path apps/pappas-order-management-desktop/src-tauri/Cargo.toml -- -D warnings`

Expected: PASS; source contains no token logging.

- [ ] **Step 5: Commit secure desktop storage**

Run: `git add apps/pappas-order-management-desktop && git commit -m "feat: add scoped desktop session storage"`

## Task 6: Implement desktop authentication, register bootstrap, and catalogue state

**Files:**
- Create: `apps/pappas-order-management-desktop/src/lib/supabase.ts`
- Create: `apps/pappas-order-management-desktop/src/features/auth/AuthProvider.tsx`
- Create: `apps/pappas-order-management-desktop/src/features/auth/LoginPage.tsx`
- Create: `apps/pappas-order-management-desktop/src/features/catalog/catalog-store.ts`
- Create: `apps/pappas-order-management-desktop/src/features/catalog/catalog-store.test.ts`
- Create: `apps/pappas-order-management-desktop/src/features/catalog/CatalogProvider.tsx`
- Modify: `apps/pappas-order-management-desktop/src/App.tsx`

**Interfaces:**
- Produces `AuthProvider`, `useAuth()`, `CatalogProvider`, `useCatalog()`, and `createCatalogStore({ load, now })`.
- Consumes `PosSecureStore`, `createSupabasePosGateway`, `buildCatalogSnapshot`, and staff authorization checks matching existing `apps/pappas-order-management/lib/auth.ts`.
- `CatalogState` is `{ status: 'idle' | 'loading' | 'ready' | 'refreshing' | 'error'; snapshot: CatalogSnapshot | null; error: string | null; refresh(reason): Promise<void>; reset(): void }`.

- [ ] **Step 1: Write failing auth/catalogue lifecycle tests**

```ts
it('does not publish a catalogue response after logout', async () => {
  const deferred = createDeferred<CatalogSource>();
  const store = createCatalogStore({ load: () => deferred.promise, now: () => 1 });
  const request = store.getState().refresh('startup');
  store.getState().reset(); deferred.resolve(sourceWithProduct('burger'));
  await request;
  expect(store.getState().snapshot).toBeNull();
});

it('retains the old snapshot when manual refresh fails', async () => {
  const store = createCatalogStore({ load: sequence(sourceWithProduct('burger'), new Error('offline')), now: () => 1 });
  await store.getState().refresh('startup'); await expect(store.getState().refresh('manual')).rejects.toThrow('offline');
  expect(store.getState().snapshot?.products[0].id).toBe('burger');
  expect(store.getState().status).toBe('ready');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter pappas-order-management-desktop test -- --run src/features/catalog/catalog-store.test.ts`

Expected: FAIL because `createCatalogStore` is absent.

- [ ] **Step 3: Implement staff bootstrap and generation-safe catalogue state**

```ts
async function refresh(reason: 'startup' | 'manual' | 'realtime') {
  const generation = ++requestedGeneration;
  set({ status: get().snapshot ? 'refreshing' : 'loading', error: null });
  try { const snapshot = await load(); if (generation === requestedGeneration && mounted) set({ snapshot, status: 'ready', error: null }); }
  catch (error) { if (generation === requestedGeneration && mounted) set({ status: get().snapshot ? 'ready' : 'error', error: messageOf(error) }); throw error; }
}
```

Restore a valid session from `PosSecureStore`, set it on the Supabase client, validate the same staff authorization contract as mobile, and clear the desktop session on invalid/expired authorization. On first authenticated mount, load the complete catalogue through the injected gateway. Realtime events schedule one debounced refresh; a refresh during an active load requests exactly one follow-up cycle. Logout increments `requestedGeneration`, clears state, unsubscribes all channels, and clears the secure session.

- [ ] **Step 4: Run focused desktop state tests**

Run: `pnpm --filter pappas-order-management-desktop test -- --run src/features/catalog/catalog-store.test.ts src/features/auth`

Expected: PASS for malformed secure storage, logout-stale response, coalesced refresh, first-load error, and retained-snapshot refresh failure.

- [ ] **Step 5: Commit authentication and catalogue state**

Run: `git add apps/pappas-order-management-desktop && git commit -m "feat: add desktop staff auth and catalog hydration"`

## Task 7: Build the desktop POS menu and cart interaction shell

**Files:**
- Create: `apps/pappas-order-management-desktop/src/features/pos/pos-types.ts`
- Create: `apps/pappas-order-management-desktop/src/features/pos/cart-store.ts`
- Create: `apps/pappas-order-management-desktop/src/features/pos/cart-store.test.ts`
- Create: `apps/pappas-order-management-desktop/src/features/pos/PosWorkspace.tsx`
- Create: `apps/pappas-order-management-desktop/src/features/pos/PosMenuPane.tsx`
- Create: `apps/pappas-order-management-desktop/src/features/pos/PosCartPane.tsx`
- Create: `apps/pappas-order-management-desktop/src/features/pos/pos.css`
- Modify: `apps/pappas-order-management-desktop/src/App.tsx`

**Interfaces:**
- Produces `useCartStore()`, `PosWorkspace`, `PosMenuPane`, and `PosCartPane`.
- Cart actions: `addProduct(product, customization)`, `setQuantity(lineId, quantity)`, `removeLine(lineId)`, `clear()`, and `subtotalCents()`.
- Consumes ready `CatalogSnapshot`; no component issues raw catalogue Supabase queries.

- [ ] **Step 1: Write failing cart and interaction tests**

```tsx
it('adds a configured product once and adjusts its quantity from the cart', () => {
  const store = createCartStore();
  store.getState().addProduct(product('burger', 1200), { addons: [{ id: 'cheese', priceCents: 150 }], removedIngredients: [] });
  const line = store.getState().lines[0]; store.getState().setQuantity(line.id, 2);
  expect(store.getState().subtotalCents()).toBe(2700);
});

it('renders an explicit empty catalogue state', () => {
  render(<PosWorkspace catalog={emptySnapshot()} />);
  expect(screen.getByText('No active products are available.')).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter pappas-order-management-desktop test -- --run src/features/pos/cart-store.test.ts`

Expected: FAIL because cart/store components do not exist.

- [ ] **Step 3: Implement a desktop-safe cart and responsive workspace**

```ts
export function createCartStore() {
  return create<CartState>((set, get) => ({ lines: [], addProduct: (product, customization) => set((state) => ({ lines: [...state.lines, makeLine(product, customization)] })), setQuantity: (id, quantity) => set((state) => ({ lines: quantity <= 0 ? state.lines.filter((line) => line.id !== id) : state.lines.map((line) => line.id === id ? { ...line, quantity } : line) })), removeLine: (id) => set((state) => ({ lines: state.lines.filter((line) => line.id !== id) })), clear: () => set({ lines: [] }), subtotalCents: () => get().lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0) }));
}
```

Use a three-region CSS grid on wide windows and stacked panes on narrow windows. Give primary controls `min-height: 48px`, visible `:focus-visible` styles, product search autofocus through an explicit shortcut, and no checkout keyboard shortcut. Show `Loading catalogue`, retryable first-load failure, stale refresh notice, and the required empty state. Match current mobile product/customization calculation rules through the shared domain package rather than copying them into React components.

- [ ] **Step 4: Run focused UI tests and production build**

Run: `pnpm --filter pappas-order-management-desktop test -- --run src/features/pos && pnpm --filter pappas-order-management-desktop build`

Expected: PASS; inspect the built CSS to confirm the minimum touch target/focus styles are present.

- [ ] **Step 5: Commit the menu/cart vertical slice**

Run: `git add apps/pappas-order-management-desktop && git commit -m "feat: add desktop POS menu and cart"`

## Task 8: Add customer selection and cash/card atomic checkout

**Files:**
- Create: `apps/pappas-order-management-desktop/src/features/checkout/checkout-service.ts`
- Create: `apps/pappas-order-management-desktop/src/features/checkout/checkout-service.test.ts`
- Create: `apps/pappas-order-management-desktop/src/features/checkout/CheckoutPanel.tsx`
- Create: `apps/pappas-order-management-desktop/src/features/customers/customer-search.ts`
- Create: `apps/pappas-order-management-desktop/src/features/customers/customer-search.test.ts`
- Modify: `apps/pappas-order-management-desktop/src/features/pos/PosWorkspace.tsx`
- Modify: `apps/pappas-order-management-desktop/src/features/pos/cart-store.ts`

**Interfaces:**
- Produces `createCheckoutService({ gateway, newId })`, `submitCashCardOrder(input)`, and `CheckoutPanel`.
- `submitCashCardOrder` returns `{ kind: 'saved'; order: SavedOrder } | { kind: 'failed'; message: string }`.
- Consumes `PosGateway.saveOrder`; it must not use a direct Supabase table write from a component.

- [ ] **Step 1: Write failing checkout idempotency tests**

```ts
it('submits one atomic save while a first cash checkout is pending', async () => {
  const pending = createDeferred<SavedOrder>();
  const service = createCheckoutService({ gateway: { saveOrder: () => pending.promise }, newId: () => 'attempt-1' });
  const first = service.submitCashCardOrder(checkoutInput('cash'));
  const second = await service.submitCashCardOrder(checkoutInput('cash'));
  expect(second).toEqual({ kind: 'failed', message: 'Checkout is already in progress.' });
  pending.resolve(savedOrder('order-1')); await expect(first).resolves.toMatchObject({ kind: 'saved' });
});

it('does not clear a cart when the authoritative save fails', async () => {
  const service = createCheckoutService({ gateway: { saveOrder: async () => { throw new Error('offline'); } }, newId: () => 'attempt-1' });
  await expect(service.submitCashCardOrder(checkoutInput('card'))).resolves.toEqual({ kind: 'failed', message: 'offline' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter pappas-order-management-desktop test -- --run src/features/checkout/checkout-service.test.ts`

Expected: FAIL because the checkout service is absent.

- [ ] **Step 3: Implement checkout only through the gateway**

```ts
export function createCheckoutService({ gateway, newId }: CheckoutDeps) {
  let pending = false;
  return { async submitCashCardOrder(input: CheckoutInput): Promise<CheckoutOutcome> {
    if (pending) return { kind: 'failed', message: 'Checkout is already in progress.' };
    pending = true;
    try { return { kind: 'saved', order: await gateway.saveOrder({ orderId: null, order: toOrderPayload(input, newId()), items: toOrderItems(input.lines) }) }; }
    catch (error) { return { kind: 'failed', message: error instanceof Error ? error.message : 'Unable to save order.' }; }
    finally { pending = false; }
  }};
}
```

Reuse existing customer-search field selection, validation, order payload construction, taxes/discounts, payment status transitions, and atomic RPC compatibility from mobile contracts. `CheckoutPanel` disables its payment buttons as soon as submission starts, shows an in-progress state, clears the cart only after `{ kind: 'saved' }`, and shows a retryable visible error without converting the failed attempt into a local order.

- [ ] **Step 4: Run checkout/customer focused tests**

Run: `pnpm --filter pappas-order-management-desktop test -- --run src/features/checkout src/features/customers && pnpm --filter pappas-order-management-desktop build`

Expected: PASS for cash/card payloads, duplicate-submission guard, error retention, and customer search normalization.

- [ ] **Step 5: Commit desktop cash/card checkout**

Run: `git add apps/pappas-order-management-desktop && git commit -m "feat: save desktop cash and card POS orders"`

## Task 9: Synchronize desktop Live Orders and POS Mirror fail-open state

**Files:**
- Create: `apps/pappas-order-management-desktop/src/features/orders/live-orders-store.ts`
- Create: `apps/pappas-order-management-desktop/src/features/orders/live-orders-store.test.ts`
- Create: `apps/pappas-order-management-desktop/src/features/orders/LiveOrdersPane.tsx`
- Create: `apps/pappas-order-management-desktop/src/features/mirror/desktop-mirror-publisher.ts`
- Create: `apps/pappas-order-management-desktop/src/features/mirror/desktop-mirror-publisher.test.ts`
- Modify: `apps/pappas-order-management-desktop/src/features/pos/PosWorkspace.tsx`
- Modify: `apps/pappas-order-management-desktop/src/features/catalog/CatalogProvider.tsx`

**Interfaces:**
- Produces `createLiveOrdersStore({ initialLoad, subscribe })` and `createDesktopMirrorPublisher({ loadRegister, upsert, debounceMs })`.
- Consumes shared Live Orders window/projection and `@my-small-business/pos-mirror` latest-write queue.
- Realtime subscription cleanup functions are called exactly once on logout/unmount.

- [ ] **Step 1: Write failing Realtime and fail-open tests**

```ts
it('replaces an existing order by ID and cleans up the subscription', async () => {
  const subscription = createSubscription(); const store = createLiveOrdersStore({ initialLoad: async () => [order('1', 'pending')], subscribe: subscription.subscribe });
  await store.start(); subscription.emit(order('1', 'preparing'));
  expect(store.getState().orders).toEqual([order('1', 'preparing')]); store.stop(); expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
});

it('swallows a mirror upsert failure after recording diagnostics', async () => {
  const publisher = createDesktopMirrorPublisher({ loadRegister: async () => ({ id: 'register-1', name: 'Desktop Register' }), upsert: async () => { throw new Error('offline'); }, debounceMs: 0, logError: vi.fn() });
  publisher.schedule(emptyMirrorOrder()); await expect(publisher.flush()).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter pappas-order-management-desktop test -- --run src/features/orders/live-orders-store.test.ts src/features/mirror/desktop-mirror-publisher.test.ts`

Expected: FAIL because the stores/publisher are absent.

- [ ] **Step 3: Implement scoped Realtime and mirror publication**

```ts
function applyOrderEvent(orders: Order[], next: Order): Order[] {
  const index = orders.findIndex((order) => order.id === next.id);
  return index < 0 ? sortLiveOrders([...orders, next]) : orders.map((order) => order.id === next.id ? next : order);
}
```

Subscribe only to authenticated, RLS-filtered order events and rehydrate safely when a minimal event cannot produce the required card projection. Publish cart snapshots using the same `pos_mirror_state` row shape, `posRegisterId` source, safe fields, and best-effort queue semantics as the existing `lib/pos-mirror-publisher.ts`. A mirror error updates a compact diagnostic indicator only; it never rejects a cart action or checkout promise.

- [ ] **Step 4: Run focused synchronization tests**

Run: `pnpm --filter pappas-order-management-desktop test -- --run src/features/orders src/features/mirror`

Expected: PASS for duplicate event reconciliation, unsubscribe, queue coalescing, and mirror failure isolation.

- [ ] **Step 5: Commit desktop synchronization**

Run: `git add apps/pappas-order-management-desktop && git commit -m "feat: synchronize desktop live orders and mirror state"`

## Task 10: Add end-to-end smoke tests and a Windows/macOS pilot checklist

**Files:**
- Create: `apps/pappas-order-management-desktop/test/e2e/desktop-pos.smoke.spec.ts`
- Create: `apps/pappas-order-management-desktop/test/fixtures/desktop-pos.ts`
- Create: `docs/testing/pos-desktop-pilot-checklist.md`
- Modify: `apps/pappas-order-management-desktop/package.json`
- Modify: `README.md`

**Interfaces:**
- Produces `test:e2e` and `test:desktop:smoke` scripts.
- The pilot checklist defines pass/fail evidence but does not claim real-device verification until it occurs.

- [ ] **Step 1: Write failing browser-level smoke specification**

```ts
test('staff can sign in, hydrate catalogue, save cash order, and observe it in live orders', async ({ page }) => {
  await page.goto('/'); await page.getByLabel('Email').fill('staff@example.test'); await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click(); await expect(page.getByText('Burger')).toBeVisible();
  await page.getByRole('button', { name: 'Burger' }).click(); await page.getByRole('button', { name: 'Cash' }).click();
  await expect(page.getByText('Order saved')).toBeVisible(); await expect(page.getByRole('region', { name: 'Live orders' })).toContainText('Order saved');
});
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run: `pnpm --filter pappas-order-management-desktop test:e2e -- --project chromium`

Expected: FAIL because the harness, deterministic gateway fixture, and accessible UI labels are absent.

- [ ] **Step 3: Add deterministic test wiring and pilot checklist**

Provide a test-only `PosGateway` fixture with staff auth, a complete one-product catalogue, atomic saved order response, and a Realtime event. Expose it only through the Vite test configuration, never in a production build. Add smoke scripts that run Vite preview plus the browser runner. Write the checklist with explicit Windows and macOS items: clean install/start, sign-in/out, catalogue startup/retry/stale refresh, keyboard/mouse/touch cart use, cash/card save, Realtime from another client, Mirror failure recovery, window resize/fullscreen, updater disabled-safe behavior, and redacted logs. Mark printer, SmartPay, caller-ID, and signed installer checks as not in this foundation release.

- [ ] **Step 4: Run all foundation verification**

Run: `pnpm --filter @my-small-business/pos-domain exec tsc --noEmit && pnpm --filter pappas-order-management-desktop test -- --run && pnpm --filter pappas-order-management-desktop build && pnpm --filter pappas-order-management-desktop test:e2e -- --project chromium && cargo test --manifest-path apps/pappas-order-management-desktop/src-tauri/Cargo.toml && git diff --check`

Expected: PASS. Separately report whether the existing broad Expo POS suite remains blocked by its known unrelated native printer/type baseline.

- [ ] **Step 5: Commit test and pilot handoff**

Run: `git add apps/pappas-order-management-desktop docs/testing/pos-desktop-pilot-checklist.md README.md && git commit -m "test: add desktop POS foundation smoke coverage"`

## Successor Plans Required Before Production Rollout

1. **Desktop operational parity:** promotions/customisations parity audit, edit/reopen, marketplace imports, delivery management, customer directory/history, reports, settings export/import, notification UX, and accessibility/kiosk polish.
2. **Desktop peripherals:** raw TCP ESC/POS Rust command, receipt document/raster rendering, per-printer queues and section routing, physical printer certification, SmartPay terminal payment lifecycle, and optional caller-ID Rust listener.
3. **Desktop release hardening:** signed Windows installer, macOS signing/notarization, updater feed and rollback policy, crash diagnostics/redaction, hardware support matrix, and two-register pilot evidence.

## Plan Self-Review

- **Spec coverage:** Tasks 1–3 establish reusable domain/data boundaries; Tasks 4–9 deliver the approved online desktop vertical slice; Task 10 supplies automated and physical-pilot evidence. Deferred features are explicitly isolated in successor plans to keep the first execution unit testable.
- **Intentional deferrals:** printing, SmartPay terminal processing, caller-ID, full operational screens, signing, and installer updates remain out of this foundation plan exactly as stated in the Global Constraints and successor-plan list.
- **Placeholder scan:** no unassigned implementation work is used as a prerequisite for a task in this plan; every task includes concrete files, interfaces, test command, implementation shape, verification, and commit.
- **Type consistency:** `PosPlatformServices`, `PosSecureStore`, `CatalogSnapshot`, `PosGateway`, `createCatalogStore`, and `createCheckoutService` are defined before their consuming tasks.
- **Review focus coverage:** secure-store failure is Task 5; stale/failed catalogue lifecycles are Task 6; empty catalogue UI is Task 7; duplicate checkout is Task 8; Mirror/Realtime isolation is Task 9.
