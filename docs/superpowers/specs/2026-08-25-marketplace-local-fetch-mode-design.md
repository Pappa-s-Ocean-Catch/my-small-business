# Marketplace Local Fetch Mode Design

## Goal

Reduce Vercel function usage from marketplace polling by allowing each POS tablet to choose where marketplace provider requests run:

- `api` (default): retain the current POS -> web API -> marketplace-provider flow.
- `local`: the POS tablet fetches marketplace providers directly, using a server-issued session bundle held only in process memory.

The change must preserve the current order import, status reconciliation, provider-specific parsing, and live-order behavior.

## Scope and constraints

- Fetch mode is saved in the existing per-tablet app settings and defaults to `api`.
- Marketplace cookies remain encrypted in `marketplace_provider_credentials` on the server. They are never stored in AsyncStorage or another persistent client store.
- In local mode, a provider session bundle contains the raw cookie header and provider configuration only in JavaScript memory.
- A cached bundle expires after one hour. The next local request obtains a fresh bundle from the authenticated web API.
- Saving provider cookies from the same tablet invalidates that tablet's in-memory bundle immediately; the next request reloads it.
- A direct provider request that receives HTTP 401 invalidates the bundle, reloads it once, and retries once. A second 401 is reported normally; no loop or automatic cookie write occurs.
- Cross-tablet invalidation is deliberately out of scope. Other tablets refresh at TTL expiry or on their own 401 response.
- Local mode changes only marketplace-provider fetches. POS order reads/writes and authentication remain on their existing Supabase/API paths.

## Shared marketplace core

Create a platform-neutral workspace library for marketplace protocol logic. It must not import React Native, Expo, Next.js, Supabase, Node `crypto`, or platform-specific storage.

The core owns:

- provider identifiers and public request/response contracts;
- provider-specific request payload builders and response normalizers;
- Uber and DoorDash headers, pagination, history date construction, and detail status data extraction;
- the shared order-detail, active-order, and history-order mappings consumed by both POS and web API;
- a fetch abstraction that accepts a standard `fetch` implementation and returns normalized results.

Uber and DoorDash remain separate adapter modules inside the shared core. They may share neutral utilities such as Melbourne date-range construction, but must not use a generic parser that can reinterpret one provider's fields as the other's.

## Server responsibilities

The web app retains encrypted credential storage and server-side API mode.

- Existing marketplace routes use the shared core with server credential/database adapters and continue returning the current public responses.
- Add an authenticated session-bundle endpoint that returns `{ provider, cookies, providerConfig, updatedAt }` only to an authenticated POS staff request.
- The endpoint must set `Cache-Control: no-store`, never log cookies, and return no data for an unconfigured provider.
- Existing credential status, save, and delete endpoints retain their behavior. The save result is used by the POS to invalidate its own memory cache.

## POS responsibilities

Introduce a marketplace fetch-mode router used by the Marketplace screen, automatic sync coordinator, and manual status refresh.

### API mode

Use the existing POS-to-web API functions unchanged.

### Local mode

1. Acquire a per-provider in-memory session bundle from the server when absent or older than one hour.
2. Call the shared marketplace core using the native tablet `fetch` and that bundle.
3. On one 401 response only, invalidate the bundle, re-fetch it from the session-bundle endpoint, and retry the same provider request.
4. Return the same normalized result shapes as API mode so import and status reconciliation need no behavioral branch.

The per-provider cache is module-scoped and is lost on an app restart. It has no persistence API.

## Settings and UI

The Marketplace section of Settings adds a two-option control:

- `API (recommended default)` — marketplace requests run through the web API.
- `Local tablet` — marketplace requests run directly from this tablet; provider sessions are fetched from the server and held in memory for up to one hour.

Saving takes effect immediately. Switching mode clears local session bundles so an old bundle is never reused after a mode transition.

## Failure behavior

- Session-bundle failures, provider 401 after retry, and provider network/API errors surface through the existing provider failure alert path.
- A failure for Uber remains isolated from DoorDash and vice versa.
- Local mode does not fall back silently to API mode: this keeps Vercel usage predictable and makes the selected mode truthful.
- Logs contain only provider, operation, mode, response status, and cache action. They never contain cookies, provider configuration secrets, orders, or customer data.

## Verification

Automated coverage will prove:

- settings default/migration and immediate mode switching;
- API mode preserves existing request routing;
- local mode obtains one bundle, reuses it within TTL, refreshes at TTL expiry, and does not persist cookies;
- saving cookies invalidates the local cache on the saving tablet;
- one 401 causes exactly one refresh and retry, with no retry loop;
- shared Uber and DoorDash adapters produce the existing normalized contracts independently;
- active, history, detail, automatic import, and manual status sync all route through the selected mode.

Manual release verification uses a designated tablet in local mode during service: confirm direct provider requests work for both providers, an Uber pickup moves the order from Live to On the Way, a forced expired session refreshes once, and API mode still behaves as before on a second tablet.
