# Marketplace Local Fetch Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each POS tablet choose API or direct marketplace fetching while retaining server-owned encrypted credentials and the existing marketplace order lifecycle.

**Architecture:** Extract provider-specific marketplace request builders and normalizers into a platform-neutral `@my-small-business/marketplace` workspace package. Web API mode and POS local mode call that package through independent credential/transport adapters, producing identical normalized contracts for the existing import and status-sync flow.

**Tech Stack:** TypeScript, pnpm workspace package, Next.js route handlers, Expo/React Native, Supabase auth, React Query, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-25-marketplace-local-fetch-mode-design.md`

## Global Constraints

- `marketplaceFetchMode` is per-tablet, persisted in the existing app settings, and defaults to `api`.
- Cookies remain encrypted on the server and must never be placed in AsyncStorage, logs, diagnostics, or persistent stores.
- The local cache is module-memory-only, expires after exactly 3,600,000 ms, invalidates after same-tablet credential save/delete or mode switch, and retries a 401 once only.
- API mode must retain current requests and response shapes.
- Uber and DoorDash retain separate provider adapters and parsers; only neutral contracts/date utilities may be shared.
- Active/order-history/detail provider fetching can switch mode; Supabase order reads/writes and staff authentication do not.
- Never log provider cookies, `ddAttKey`, provider config secrets, orders, or customer data.

---

## File structure

- `libs/marketplace/package.json`, `index.ts`, `src/contracts.ts`, `src/uber-eats.ts`, `src/doordash.ts`, `src/client.ts`: browser/React Native/Node-neutral provider contracts, builders, response normalizers, and fetch-based client.
- `libs/marketplace/test/*.test.ts`: provider fixture tests proving independent normalized output and request payloads.
- `apps/web/src/lib/marketplace-credentials.ts`: server credential adapter only.
- `apps/web/src/app/api/marketplace/providers/[provider]/{active,history,orders/[workflowUuid]}/route.ts`: thin API-mode adapters around the shared client.
- `apps/web/src/app/api/marketplace/providers/[provider]/session/route.ts`: authenticated no-store raw session-bundle endpoint for local mode.
- `apps/pappas-order-management/lib/marketplace-api-client.ts`: existing API-mode client moved without behavioral changes.
- `apps/pappas-order-management/lib/marketplace-local-client.ts`: memory-only session cache, direct-provider transport, one-401 refresh/retry.
- `apps/pappas-order-management/lib/marketplace-client.ts`: fetch-mode router exposing the existing marketplace methods.
- `apps/pappas-order-management/lib/settings.ts`, Settings UI, and tests: per-tablet mode persistence and selection.
- `apps/pappas-order-management/providers/MarketplaceSyncProvider.tsx`, Marketplace screen, and Order Detail modal: consume the routed client instead of API-only imports.

### Task 1: Create the platform-neutral marketplace package

**Files:**
- Create: `libs/marketplace/package.json`, `libs/marketplace/tsconfig.json`, `libs/marketplace/index.ts`
- Create: `libs/marketplace/src/contracts.ts`, `libs/marketplace/src/uber-eats.ts`, `libs/marketplace/src/doordash.ts`, `libs/marketplace/src/client.ts`
- Create: `libs/marketplace/test/uber-eats.test.ts`, `libs/marketplace/test/doordash.test.ts`
- Modify: `apps/web/tsconfig.json`, `apps/pappas-order-management/tsconfig.json`, `apps/web/package.json`, `apps/pappas-order-management/package.json`

**Interfaces:**

```ts
export type MarketplaceProvider = 'uber_eats' | 'doordash';
export type MarketplaceSessionBundle = {
  provider: MarketplaceProvider;
  cookies: string;
  providerConfig: Record<string, string | number | boolean | null>;
  updatedAt: string | null;
};
export type MarketplaceTransport = (input: {
  url: string;
  init: RequestInit;
}) => Promise<Response>;
export function createMarketplaceProviderClient(input: {
  getSession: (provider: MarketplaceProvider) => Promise<MarketplaceSessionBundle>;
  transport?: MarketplaceTransport;
}): {
  getActiveOrders(provider: MarketplaceProvider, cursor?: string): Promise<MarketplaceActiveResult>;
  getHistory(provider: MarketplaceProvider, options?: MarketplaceHistoryOptions): Promise<MarketplaceHistoryResult>;
  getOrderDetail(provider: MarketplaceProvider, workflowUuid: string, options?: { mode?: 'history' | 'live' }): Promise<MarketplaceOrderDetail>;
};
```

- [ ] **Step 1: Write failing provider-contract tests**

```ts
test('normalizes Uber active rows without accepting DoorDash fields', async () => {
  const result = await client.getActiveOrders('uber_eats');
  assert.equal(result.orders[0].workflowUuid, 'uber-workflow');
  assert.equal(result.orders[0].orderUuid, 'uber-order');
});

test('builds DoorDash history UTC boundaries from the Melbourne calendar day', async () => {
  await client.getHistory('doordash', { dateRange: 'TODAY' });
  assert.equal(postedBody.dateGte, '2026-08-24T14:00:00.000Z');
  assert.equal(postedBody.dateLt, '2026-08-25T13:59:59.999Z');
});
```

- [ ] **Step 2: Run the package tests and verify they fail because the package does not exist**

Run: `pnpm --filter @my-small-business/marketplace test`

Expected: FAIL with missing workspace package/test script.

- [ ] **Step 3: Implement explicit provider modules and a shared client**

Move the existing provider protocol code from the three web route handlers into provider-owned functions. Keep Uber local `dateFilter` strings and DoorDash's Melbourne-to-UTC conversion in their respective adapters. Require provider response status validation before normalization and throw messages containing provider plus operation, but never credentials.

- [ ] **Step 4: Run focused shared-package tests**

Run: `pnpm --filter @my-small-business/marketplace test`

Expected: PASS with all Uber and DoorDash fixtures green.

- [ ] **Step 5: Commit the package extraction**

```bash
git add libs/marketplace apps/web/package.json apps/web/tsconfig.json apps/pappas-order-management/package.json apps/pappas-order-management/tsconfig.json
git commit -m "feat: add shared marketplace provider client"
```

### Task 2: Make web routes API-mode adapters and expose a no-store session bundle

**Files:**
- Modify: `apps/web/src/lib/marketplace-credentials.ts`
- Modify: `apps/web/src/app/api/marketplace/providers/[provider]/active/route.ts`
- Modify: `apps/web/src/app/api/marketplace/providers/[provider]/history/route.ts`
- Modify: `apps/web/src/app/api/marketplace/providers/[provider]/orders/[workflowUuid]/route.ts`
- Create: `apps/web/src/app/api/marketplace/providers/[provider]/session/route.ts`
- Test: `apps/web/src/lib/marketplace-session.test.ts`

**Interfaces:**

```ts
export async function getMarketplaceSessionBundle(
  provider: MarketplaceProvider
): Promise<MarketplaceSessionBundle>;
// GET /api/marketplace/providers/:provider/session
// Response: { success: true, data: MarketplaceSessionBundle }
// Headers: Cache-Control: no-store
```

- [ ] **Step 1: Write failing route/helper tests**

```ts
test('returns only an authenticated provider session bundle with no-store caching', async () => {
  const response = await GET(authenticatedRequest, routeContext('uber_eats'));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      provider: 'uber_eats',
      cookies: 'session=redacted-fixture',
      providerConfig: {},
      updatedAt: '2026-08-25T00:00:00.000Z',
    },
  });
});
```

- [ ] **Step 2: Run the web-focused test and verify it fails**

Run: `pnpm --filter web exec node --test src/lib/marketplace-session.test.ts`

Expected: FAIL because the session-bundle helper/route does not exist.

- [ ] **Step 3: Implement the credential bundle and route**

Reuse staff API authentication and the existing decrypt-on-server implementation. Return the raw cookie header only from `/session`; do not alter the existing credential status GET response. Set `Cache-Control: no-store` and return the existing API error envelope for missing/unsupported providers.

- [ ] **Step 4: Replace server route protocol implementations with shared-client calls**

Each route obtains its server session bundle, calls the shared client, and returns its existing response envelope. Preserve the Uber workflow UUID on detail responses and the current history logging, while keeping diagnostic logs redacted.

- [ ] **Step 5: Run web verification**

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web exec node --test src/lib/marketplace-session.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit web adapter work**

```bash
git add apps/web/src/lib/marketplace-credentials.ts apps/web/src/app/api/marketplace/providers
git commit -m "feat: expose marketplace sessions for local fetch mode"
```

### Task 3: Add the per-tablet fetch-mode setting

**Files:**
- Modify: `apps/pappas-order-management/lib/settings.ts`
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx`
- Test: `apps/pappas-order-management/test/marketplace-fetch-mode-settings.test.ts`

**Interfaces:**

```ts
export type MarketplaceFetchMode = 'api' | 'local';
export type AppSettings = {
  // existing fields
  marketplaceFetchMode: MarketplaceFetchMode;
};
```

- [ ] **Step 1: Write failing settings tests**

```ts
test('defaults a missing marketplace fetch mode to api', async () => {
  await AsyncStorage.setItem('pappas-order-management.settings.v1', '{}');
  assert.equal((await loadAppSettings()).marketplaceFetchMode, 'api');
});

test('persists local marketplace fetch mode on this tablet', async () => {
  await saveAppSettings({ ...DEFAULT_APP_SETTINGS, marketplaceFetchMode: 'local' });
  assert.equal((await loadAppSettings()).marketplaceFetchMode, 'local');
});
```

- [ ] **Step 2: Run the focused settings test and verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- marketplace-fetch-mode-settings`

Expected: FAIL because `marketplaceFetchMode` is absent.

- [ ] **Step 3: Add the setting and UI control**

Normalize unknown/migrated values to `api`. Add API and Local tablet buttons under Marketplace Settings with copy that accurately describes direct provider requests and one-hour in-memory sessions. Saving applies immediately through the existing settings store.

- [ ] **Step 4: Run focused settings tests**

Run: `pnpm --filter pappas-order-management test:unit -- marketplace-fetch-mode-settings`

Expected: PASS.

- [ ] **Step 5: Commit settings work**

```bash
git add apps/pappas-order-management/lib/settings.ts apps/pappas-order-management/app/'(drawer)'/'(tabs)'/settings.tsx apps/pappas-order-management/test/marketplace-fetch-mode-settings.test.ts
git commit -m "feat: add per-tablet marketplace fetch mode"
```

### Task 4: Implement local session caching and the mode router

**Files:**
- Create: `apps/pappas-order-management/lib/marketplace-api-client.ts`
- Create: `apps/pappas-order-management/lib/marketplace-local-client.ts`
- Create: `apps/pappas-order-management/lib/marketplace-client.ts`
- Modify: `apps/pappas-order-management/lib/marketplace.ts`
- Test: `apps/pappas-order-management/test/marketplace-local-client.test.ts`

**Interfaces:**

```ts
export const MARKETPLACE_SESSION_TTL_MS = 3_600_000;
export function createMarketplaceLocalClient(input: {
  getSessionBundle(provider: MarketplaceProvider): Promise<MarketplaceSessionBundle>;
  now(): number;
  createProviderClient(getSession: ...): MarketplaceProviderClient;
}): MarketplaceProviderClient & {
  invalidate(provider?: MarketplaceProvider): void;
};
export function createMarketplaceClient(input: {
  getMode(): MarketplaceFetchMode;
  api: MarketplaceProviderClient;
  local: MarketplaceProviderClient;
}): MarketplaceProviderClient;
```

- [ ] **Step 1: Write failing local-client tests**

```ts
test('reuses a session bundle for one hour without requesting the API again', async () => {
  await client.getActiveOrders('uber_eats');
  await client.getActiveOrders('uber_eats');
  assert.equal(bundleCalls, 1);
});

test('refreshes once and retries once after provider 401', async () => {
  const result = await client.getActiveOrders('uber_eats');
  assert.equal(result.orders.length, 1);
  assert.equal(bundleCalls, 2);
  assert.equal(providerCalls, 2);
});

test('does not retry a second 401', async () => {
  await assert.rejects(() => client.getActiveOrders('uber_eats'), /401/);
  assert.equal(providerCalls, 2);
});
```

- [ ] **Step 2: Run the focused local-client test and verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- marketplace-local-client`

Expected: FAIL because the local client is absent.

- [ ] **Step 3: Implement memory cache and API/local router**

Move the current authenticated HTTP functions into `marketplace-api-client.ts`. The local client calls `/session` only when its per-provider cache is absent/stale, then calls the shared package directly. Detect `Response.status === 401` at transport level, invalidate only that provider, reload once, and retry the original operation once. Never serialize the cache.

- [ ] **Step 4: Invalidate after same-tablet credential changes**

After successful `saveMarketplaceCookies` or `deleteMarketplaceCookies`, call `localMarketplaceClient.invalidate(provider)`. Switching `marketplaceFetchMode` calls `invalidate()` for all providers.

- [ ] **Step 5: Run focused client tests**

Run: `pnpm --filter pappas-order-management test:unit -- marketplace-local-client`

Expected: PASS.

- [ ] **Step 6: Commit local fetch client work**

```bash
git add apps/pappas-order-management/lib/marketplace*.ts apps/pappas-order-management/test/marketplace-local-client.test.ts
git commit -m "feat: add local marketplace fetch client"
```

### Task 5: Route all POS marketplace consumers through the selected mode

**Files:**
- Modify: `apps/pappas-order-management/providers/MarketplaceSyncProvider.tsx`
- Modify: `apps/pappas-order-management/components/OrderDetailModal.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/marketplace.tsx`
- Modify: `apps/pappas-order-management/providers/MarketplaceSyncGate.tsx`
- Test: `apps/pappas-order-management/test/marketplace-client-routing.test.ts`

**Interfaces:**

```ts
// Selected methods retain their existing signatures:
getMarketplaceActiveOrders(provider, cursor?)
getMarketplaceHistory(provider, options?)
getMarketplaceOrderDetail(provider, workflowUuid, options?)
```

- [ ] **Step 1: Write failing routing tests**

```ts
test('uses the selected client for automatic active-order sync', async () => {
  await coordinator.poll();
  assert.equal(localActiveCalls, 2);
  assert.equal(apiActiveCalls, 0);
});

test('uses the selected client for manual marketplace status refresh', async () => {
  await syncMarketplaceOrderOnDemand({ ...input, getOrderDetail: selectedClient.getOrderDetail });
  assert.equal(localDetailCalls, 1);
});
```

- [ ] **Step 2: Run focused routing tests and verify they fail**

Run: `pnpm --filter pappas-order-management test:unit -- marketplace-client-routing`

Expected: FAIL because consumers still import API-only functions.

- [ ] **Step 3: Replace API-only imports with the selected client**

Inject the selected client into the sync provider based on `settings.marketplaceFetchMode`. Make the Marketplace screen and Order Detail modal use the router's functions. Preserve interval, app-state, per-provider alert, import, and status-only write behavior.

- [ ] **Step 4: Run focused routing and existing marketplace tests**

Run: `pnpm --filter pappas-order-management test:unit -- marketplace-client-routing marketplace-sync marketplace-pos-order`

Expected: PASS.

- [ ] **Step 5: Commit consumer routing work**

```bash
git add apps/pappas-order-management/providers apps/pappas-order-management/components/OrderDetailModal.tsx apps/pappas-order-management/app/'(drawer)'/marketplace.tsx apps/pappas-order-management/test/marketplace-client-routing.test.ts
git commit -m "feat: route marketplace fetches by tablet mode"
```

### Task 6: Complete verification and release checks

**Files:**
- Modify only if verification exposes a scoped defect in the preceding tasks.

- [ ] **Step 1: Run shared package and web verification**

Run: `pnpm --filter @my-small-business/marketplace test && pnpm --filter web exec tsc --noEmit`

Expected: PASS.

- [ ] **Step 2: Run POS unit verification and record native baseline separately if present**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: all marketplace tests pass. If the known native printer type errors still stop the suite before Node tests, run the emitted marketplace test artifacts and report that baseline separately.

- [ ] **Step 3: Check workspace diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only planned files changed.

- [ ] **Step 4: Perform physical tablet release checks**

1. Set tablet A to API and confirm active Uber/DoorDash polling and manual detail refresh remain server-proxied.
2. Set tablet A to Local and confirm the session endpoint is called once per provider, then direct provider requests occur without repeated Vercel marketplace route calls.
3. Wait/advance one hour and confirm the next local call reloads the session bundle.
4. Replace the same tablet's marketplace cookie, then confirm the next local call fetches the new bundle.
5. Force one expired session: confirm exactly one reload/retry; verify the second 401 produces a visible provider error.
6. Confirm an Uber courier pickup writes `on_the_way` and moves the order out of Live Orders.
7. Confirm DoorDash active/history/detail outputs match API mode.

- [ ] **Step 5: Commit verification-only corrections if any**

```bash
git add <scoped-files>
git commit -m "fix: verify marketplace local fetch mode"
```
