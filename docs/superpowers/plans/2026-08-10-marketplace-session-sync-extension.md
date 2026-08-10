# Marketplace Session Sync Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private Chrome extension that lets staff explicitly refresh Uber Eats and DoorDash portal cookies through a secure, validated API endpoint.

**Architecture:** A Manifest V3 extension reads cookies only after a portal-page button click and sends them to a new dedicated endpoint using a header-based shared secret. The endpoint verifies the secret in constant time, validates the submitted marketplace session using provider-specific lightweight requests, and then reuses the current encrypted credential persistence path.

**Tech Stack:** Chrome Manifest V3, vanilla extension JavaScript, Next.js route handlers, TypeScript, Node test runner, Supabase service-role persistence, AES-256-GCM credential encryption.

## Global Constraints

- Do not put the shared secret in a URL, query parameter, console output, or response body.
- Extension settings use `chrome.storage.local`; cookies must never be stored there.
- The extension uploads cookies only after staff reviews a read-only cookie header and chooses `Submit session` in the portal dialog.
- Limit portal host permissions to Uber Eats Manager and DoorDash Merchant pages.
- Validate a new session before replacing the existing encrypted credentials.
- Do not log cookie values, extension secret values, request headers, or provider response bodies.
- Keep all changes uncommitted on the current user branch.

---

### Task 1: Add server-side extension authentication and safe credential validation helpers

**Files:**
- Modify: `apps/web/src/lib/marketplace-credentials.ts`
- Create: `apps/web/src/lib/marketplace-extension-sync.ts`
- Test: `apps/web/src/lib/marketplace-extension-sync.test.ts`

**Interfaces:**
- Consumes: `parseMarketplaceProvider()` and `saveMarketplaceCookies()` from `marketplace-credentials.ts`.
- Produces: `authenticateMarketplaceExtensionRequest(request: Request): boolean` and `validateMarketplaceExtensionCookies(provider, cookies): Promise<{ ok: boolean; error?: string; providerConfig?: Record<string, string | number | boolean | null> }>`.

- [ ] **Step 1: Write failing tests for secret authentication and validation outcomes**

```ts
test('accepts only the configured extension header using a timing-safe comparison', () => {
  assert.equal(isMarketplaceExtensionSecretValid('sync-secret', 'sync-secret'), true);
  assert.equal(isMarketplaceExtensionSecretValid('wrong-secret', 'sync-secret'), false);
});

test('does not persist validation-failed marketplace cookies', async () => {
  const result = await syncMarketplaceExtensionCredentials({
    provider: 'uber_eats',
    cookies: 'sid=expired',
    validate: async () => ({ ok: false, error: 'Uber Eats session validation failed' }),
    save: async () => { throw new Error('must not save'); },
  });
  assert.equal(result.success, false);
  assert.equal(result.error, 'Uber Eats session validation failed');
});
```

- [ ] **Step 2: Run the new test file and verify it fails because the helpers do not exist**

Run: `node --experimental-strip-types --test apps/web/src/lib/marketplace-extension-sync.test.ts`

Expected: failure resolving `marketplace-extension-sync.ts`.

- [ ] **Step 3: Implement secret comparison and validation helpers**

```ts
export function isMarketplaceExtensionSecretValid(received: string | null, configured: string) {
  const receivedBuffer = Buffer.from(received || '');
  const configuredBuffer = Buffer.from(configured);
  return receivedBuffer.length === configuredBuffer.length
    && timingSafeEqual(receivedBuffer, configuredBuffer);
}

export async function syncMarketplaceExtensionCredentials(input: ExtensionCredentialSyncInput) {
  const validation = await input.validate(input.provider, input.cookies);
  if (!validation.ok) return { success: false, error: validation.error || 'Marketplace session validation failed' };
  await input.save({ provider: input.provider, cookies: input.cookies, providerConfig: validation.providerConfig });
  return { success: true };
}
```

Implement Uber Eats validation using the selected-restaurant cookie plus a lightweight active-orders request; implement DoorDash validation using the existing credential configuration and a lightweight active-orders request. Reject blank or over-64KB cookie strings before upstream calls.

- [ ] **Step 4: Run the helper tests and verify they pass**

Run: `node --experimental-strip-types --test apps/web/src/lib/marketplace-extension-sync.test.ts`

Expected: all extension-sync helper tests pass.

- [ ] **Step 5: Leave changes uncommitted**

Do not commit; this is an explicit user requirement for the current branch.

### Task 2: Add the extension credential-ingestion route

**Files:**
- Create: `apps/web/src/app/api/marketplace/extension-sync/route.ts`
- Test: `apps/web/src/lib/marketplace-extension-sync.test.ts`

**Interfaces:**
- Consumes: Task 1 `isMarketplaceExtensionSecretValid()` and `syncMarketplaceExtensionCredentials()`.
- Produces: `POST /api/marketplace/extension-sync` accepting `{ provider, cookies }` and `X-Marketplace-Sync-Key`.

- [ ] **Step 1: Extend failing tests for request rejection and successful save**

```ts
test('rejects a missing extension secret without calling validation', async () => {
  const response = await postExtensionSync({ provider: 'doordash', cookies: 'sid=valid' });
  assert.equal(response.status, 401);
});

test('returns provider and update time after a validated session is saved', async () => {
  const response = await postExtensionSync(
    { provider: 'doordash', cookies: 'sid=valid' },
    { 'X-Marketplace-Sync-Key': 'sync-secret' },
  );
  assert.deepEqual(await response.json(), {
    success: true,
    data: { provider: 'doordash', updatedAt: '2026-08-10T00:00:00.000Z' },
  });
});
```

- [ ] **Step 2: Run the test and verify the route contract is missing**

Run: `node --experimental-strip-types --test apps/web/src/lib/marketplace-extension-sync.test.ts`

Expected: failure because the route request helper does not exist.

- [ ] **Step 3: Implement the route with strict request handling**

```ts
const secret = process.env.MARKETPLACE_EXTENSION_SYNC_SECRET;
if (!secret || !isMarketplaceExtensionSecretValid(request.headers.get('X-Marketplace-Sync-Key'), secret)) {
  return NextResponse.json({ success: false, error: 'Unauthorized extension sync request' }, { status: 401 });
}
```

Parse JSON once, accept only `uber_eats` or `doordash`, enforce a 64KB cookie limit, call Task 1 validation-and-save flow, and return only provider plus `updatedAt`. Add an explicit `OPTIONS` handler that permits `POST`, `Content-Type`, and `X-Marketplace-Sync-Key` only for a configured `MARKETPLACE_EXTENSION_ALLOWED_ORIGIN`; do not use wildcard CORS.

- [ ] **Step 4: Run the extension-sync tests and web typecheck**

Run: `node --experimental-strip-types --test apps/web/src/lib/marketplace-extension-sync.test.ts && pnpm --filter web exec tsc --noEmit --pretty false`

Expected: tests and TypeScript check pass.

- [ ] **Step 5: Leave changes uncommitted**

Do not commit; this is an explicit user requirement for the current branch.

### Task 3: Build the private Chrome extension settings and background sender

**Files:**
- Create: `Plugins/marketplace-session-sync-extension/manifest.json`
- Create: `Plugins/marketplace-session-sync-extension/background.js`
- Create: `Plugins/marketplace-session-sync-extension/options.html`
- Create: `Plugins/marketplace-session-sync-extension/options.js`
- Create: `Plugins/marketplace-session-sync-extension/extension-core.js`
- Test: `Plugins/marketplace-session-sync-extension/extension-core.test.mjs`

**Interfaces:**
- Consumes: Task 2 endpoint and `X-Marketplace-Sync-Key` header.
- Produces: `getProviderForUrl(url)`, `buildCookieHeader(cookies)`, and `syncProviderSession(provider)` message handler.

- [ ] **Step 1: Write failing extension-core tests**

```js
test('recognizes only the supported marketplace portal URLs', () => {
  assert.equal(getProviderForUrl('https://merchants.ubereats.com/manager/orders'), 'uber_eats');
  assert.equal(getProviderForUrl('https://www.doordash.com/merchant/orders'), 'doordash');
  assert.equal(getProviderForUrl('https://example.com/merchant/orders'), null);
});

test('joins cookies into an HTTP Cookie header without logging them', () => {
  assert.equal(buildCookieHeader([{ name: 'sid', value: 'abc' }, { name: 'x', value: '1' }]), 'sid=abc; x=1');
});
```

- [ ] **Step 2: Run the extension-core tests and verify they fail**

Run: `node --test Plugins/marketplace-session-sync-extension/extension-core.test.mjs`

Expected: failure because `extension-core.js` does not exist.

- [ ] **Step 3: Create the Manifest V3 extension and core helpers**

```json
{
  "manifest_version": 3,
  "permissions": ["cookies", "storage"],
  "host_permissions": [
    "https://merchants.ubereats.com/*",
    "https://www.doordash.com/*",
    "https://pappasfishnchips.com.au/*"
  ]
}
```

The options page collects base URL and shared secret and saves them in `chrome.storage.local`. `background.js` reads cookies directly from `chrome.cookies.getAll`, sends a JSON POST to `${apiBaseUrl}/api/marketplace/extension-sync`, and never logs settings or cookie strings.

- [ ] **Step 4: Run extension-core tests**

Run: `node --test Plugins/marketplace-session-sync-extension/extension-core.test.mjs`

Expected: all extension-core tests pass.

- [ ] **Step 5: Leave changes uncommitted**

Do not commit; this is an explicit user requirement for the current branch.

### Task 4: Add portal buttons, feedback, and installation documentation

**Files:**
- Create: `Plugins/marketplace-session-sync-extension/content.js`
- Create: `Plugins/marketplace-session-sync-extension/README.md`
- Create: `Plugins/marketplace-session-sync-extension/INSTALL.md`
- Modify: `Plugins/marketplace-session-sync-extension/manifest.json`

**Interfaces:**
- Consumes: Task 3 `SYNC_PROVIDER_SESSION` background message.
- Produces: a visible `Sync marketplace session` button only on supported logged-in portal pages.

- [ ] **Step 1: Write a failing content-script behavior test for provider-specific rendering**

```js
test('renders one sync button only on a supported portal page', () => {
  const document = createDocument('https://merchants.ubereats.com/manager/orders');
  mountMarketplaceSessionSyncButton(document, 'uber_eats');
  mountMarketplaceSessionSyncButton(document, 'uber_eats');
  assert.equal(document.querySelectorAll('[data-marketplace-session-sync]').length, 1);
});
```

- [ ] **Step 2: Run the content-script test and verify it fails before implementation**

Run: `node --test Plugins/marketplace-session-sync-extension/extension-core.test.mjs`

Expected: failure because the button mount helper does not exist.

- [ ] **Step 3: Implement the button and status feedback**

```js
button.textContent = 'Sync marketplace session';
button.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = 'Syncing…';
  const result = await chrome.runtime.sendMessage({ type: 'SYNC_PROVIDER_SESSION', provider });
  status.textContent = result.success ? 'Session updated' : result.error;
  button.disabled = false;
});
```

Use a `MutationObserver` only to remount the button after portal navigation. Documentation must include unpacked installation, required `MARKETPLACE_EXTENSION_SYNC_SECRET`, and how to test signed-in and signed-out cases. Do not document or show real cookie values.

- [ ] **Step 4: Run extension tests, web typecheck, and whitespace check**

Run: `node --test Plugins/marketplace-session-sync-extension/extension-core.test.mjs && pnpm --filter web exec tsc --noEmit --pretty false && git diff --check`

Expected: all checks pass.

- [ ] **Step 5: Perform manual extension checks**

1. Load unpacked extension with production API base URL and secret.
2. On a signed-in Uber Eats portal, click Sync and confirm the success message.
3. On a signed-in DoorDash portal, click Sync and confirm the success message.
4. On a logged-out portal, confirm failure does not replace saved credentials.
5. Confirm browser console and server logs contain no cookie values or shared-secret values.

- [ ] **Step 6: Leave changes uncommitted**

Do not commit; this is an explicit user requirement for the current branch.
