# Marketplace Session Sync Extension

## Goal

Reduce manual marketplace session-cookie updates by providing a private Chrome extension with a staff-initiated sync button on the Uber Eats and DoorDash merchant portals.

## Scope

- A Manifest V3 Chrome extension under `Plugins/marketplace-session-sync-extension`.
- Buttons injected only on:
  - `https://merchants.ubereats.com/manager/*`
  - `https://www.doordash.com/merchant/*`
- Extension settings for API base URL, sync secret, and provider enablement.
- A new unauthenticated-for-staff-session API endpoint dedicated to extension sync.
- Cookie validation before the encrypted credential is replaced.

## Extension

The extension uses Chrome `webRequest` and provider host permissions to observe the latest `Cookie` header on only these provider API patterns: Uber Eats `https://merchants.ubereats.com/manager/api/*` and DoorDash `https://merchant-portal.doordash.com/merchant-analytics-service/api*`. It holds that header only in service-worker memory. It does not read portal page content, inspect orders, or upload anything automatically.

Each provider button says `Sync marketplace session`. Clicking it:

1. Reads cookies for that provider’s portal domain and opens a review dialog.
2. Shows the assembled cookie header in a read-only field with a Copy button; it is not uploaded at this stage.
3. Sends `provider` and that exact reviewed cookie header in a JSON request body only after staff chooses `Submit session`.
4. Sends the configured secret only in the `X-Marketplace-Sync-Key` header.
5. Displays pending, success, or failure state next to the button or in the review dialog.

The extension stores its settings in `chrome.storage.local`. It never writes cookies to extension storage and never logs cookie values.

## API

The endpoint is `POST /api/marketplace/extension-sync`.

Request body:

```json
{ "provider": "uber_eats", "cookies": "name=value; ..." }
```

Required header:

```text
X-Marketplace-Sync-Key: <shared secret>
```

The server compares the header using a timing-safe check against `MARKETPLACE_EXTENSION_SYNC_SECRET`. It rejects a missing or incorrect secret, an unsupported provider, an empty cookie header, oversized input, or a failed marketplace validation request.

Validation uses a lightweight existing marketplace request with the submitted cookies. The request must return a successful provider response before the credential is persisted. Validation errors do not replace an already-working saved credential.

On success, the endpoint calls the existing `saveMarketplaceCookies` encryption path, recording the source as `marketplace-extension` in the existing configuration metadata. Its response contains provider, success state, and update time only; never cookie data.

## Security

- The shared secret is sent in a request header, never a query parameter.
- The API allows only HTTPS production origins and configured local development origin through extension host permissions.
- Cookies are submitted only after an explicit user click.
- Cookies are encrypted at rest by the current `MARKETPLACE_CONFIG_SECRET` AES-256-GCM implementation.
- Server logs may include provider and failure category but must not include secrets, headers, cookie values, or upstream response bodies.
- The new endpoint has request-size limits and no CORS wildcard; allowed extension origins are explicitly configured by the extension ID once the packaged ID is known. Local unpacked development is supported by an explicit development setting rather than permissive production CORS.

## Failure handling

- Not signed in to a portal: the extension reports that no session cookies were found.
- Incorrect API URL or secret: endpoint returns an authentication error and saved provider credentials remain unchanged.
- Cookie expired or provider validation fails: endpoint returns the provider failure; saved credentials remain unchanged.
- Network failure: extension displays retry guidance and does not retry automatically.

## Tests

- Server unit tests cover header authentication, invalid provider/body, validation failure preserving existing credentials, and successful encrypted save.
- Extension unit-level tests cover provider URL detection, cookie-header construction without sensitive logging, and API response state mapping.
- Manual checks cover each button on a signed-in portal and a logged-out portal.
