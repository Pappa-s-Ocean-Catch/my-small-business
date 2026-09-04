# HT813 caller ID listener design

## Purpose and scope

Add an Android-only, opt-in caller ID listener to the Pappas Order Management POS. When the POS is open and the local setting is enabled, it receives HT813 SIP/UDP INVITEs, extracts the raw caller identity, and shows staff a brief, non-blocking on-screen notification.

The feature does not make SIP registrations, receive audio, normalize phone numbers, look up customers, persist call data, call Supabase, or contact any other network service.

## Architecture

Create a workspace Expo module at `libs/caller-id-listener`, modeled on the existing local Expo modules. Its Android implementation owns a single `DatagramSocket`, a background coroutine or worker, SIP parsing, and a bounded in-memory deduplication cache. The module is autolinked by Expo; its app plugin adds `android.permission.INTERNET` declaratively, without modifying generated Android files.

The package exports a typed JavaScript adapter. It shields the app from a missing native module (such as web, Expo Go, or a stale development build), exposes `start(port)`, `stop()`, `isRunning()`, and status/event subscription helpers, and has no application business behavior.

A global `CallerIdListenerProvider`, mounted below hydrated app settings and the authenticated POS shell, owns the application lifecycle. It starts the native module only when a staff session is active and `callerIdEnabled` is true; it stops on disable, logout, unmount, native error, or port change. It renders the global status chip and incoming-call overlay.

## Native contract

`CallerIdListener.start(port?: number)` defaults to port 5060. It binds UDP to `0.0.0.0:<port>` off the Android main and React Native UI threads. Calling start repeatedly for an already-running port is a no-op. Starting with a different port is handled by the provider as stop then start, so at most one socket and worker exist. `stop()` is safe when idle and closes the socket to unblock the receive loop. Module destruction performs the same cleanup.

The native module emits:

- `CallerIdIncomingCall`: `{ phoneNumber: string, callId?: string, timestamp: number }`
- `CallerIdListenerStatus`: `{ state: 'starting' | 'listening' | 'stopped' | 'error', port?: number, message?: string }`

For each UDP payload, the parser accepts only a SIP request whose first line is an `INVITE`. It reads headers case-insensitively, supports folded header continuations, and extracts the first usable SIP user part in this priority: `P-Asserted-Identity`, `Remote-Party-ID`, then `From`. It preserves the number exactly (including a leading `+`), rejects empty, anonymous, and private values, and reads `Call-ID` when supplied. Malformed datagrams are ignored.

The listener records emitted non-empty Call-IDs in a bounded, non-persistent cache. A repeat INVITE with the same Call-ID inside a five-minute TTL emits no duplicate event. Expired entries are pruned during packet processing; the cache has a maximum size so noisy traffic cannot grow memory without bound. Calls without Call-ID remain eligible rather than risking suppression of distinct calls.

Debug builds may log lifecycle, source address, INVITE recognition, redacted identity metadata, Call-ID, and emissions. They must not log whole SIP payloads in production.

## Settings and POS UI

Extend the device-local `AppSettings` schema and its load/save normalization:

- `callerIdEnabled: boolean`, default `false`.
- `callerIdPort: number`, default `5060`, clamped to `1..65535`.
- `callerIdDisplaySeconds: number`, default `8`, clamped to `2..60`.

The Register Settings section adds a `Caller ID listener` tile and full-screen configuration view consistent with current settings patterns. It provides the enable switch, port, auto-dismiss duration, and live status. Saving a changed enabled configuration immediately reconciles the provider; enabling begins listening, disabling releases the port.

Every authenticated POS route shows a compact, non-blocking chip indicating Off, Starting, Listening on the configured port, or Error. The Error state includes an actionable short reason in the Settings view. Leaving the setting enabled after a bind failure lets staff correct the port or toggle it to retry.

On `CallerIdIncomingCall`, the provider displays a small floating call card above app content. It is deliberately not a React Native `Modal`: content outside the card remains touchable, so active checkout and order workflows continue uninterrupted. The card displays the raw caller number and a Close action. It dismisses after the configured duration. A subsequent incoming call replaces the displayed number and resets the dismissal timer.

## Error handling and lifecycle

Socket-bind and worker failures result in a native status event, never a crash. The provider stops any residual native listener on such an error and reports Error. Bad settings values are normalized before start. A missing native module reports unavailable status in development and does not crash web or stale builds. `INTERNET` is required in the Android manifest; no runtime dangerous permission is needed for LAN UDP.

V1 only listens while the React Native POS process is alive. It does not use a foreground service, and it does not promise reception while Android has backgrounded or terminated the app. The native classes retain clean socket/worker boundaries so a later foreground-service implementation can reuse the listener/parser safely.

## Verification

Add testable, platform-independent TypeScript parser and controller tests for the event adapter and UI lifecycle. Kotlin parser tests, where supported by the module Gradle setup, cover the native parser directly. Required cases:

- `From` with Australian local mobile and a `+61` value, preserving both.
- Priority of P-Asserted-Identity, Remote-Party-ID, and From.
- Anonymous, malformed, non-INVITE, and invalid identity messages produce no caller event.
- One Call-ID is emitted once; a different Call-ID is emitted separately; expiry permits a future event.
- `start` and `stop` idempotency, port change reconciliation, and binding failure status.
- Settings defaults, load migration, bounds, and save normalization.
- Call card automatic dismissal, manual close, replacement behavior, and absence of the native module.

Focused TypeScript tests and module compilation demonstrate code-level correctness. Final validation requires a fresh Android development or APK build and installation because local native-module additions are not delivered by OTA, followed by LAN testing against a real HT813 or a UDP sender that emits representative SIP INVITEs.
