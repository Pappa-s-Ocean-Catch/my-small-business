# Native Raw-TCP Printer Design

## Goal

Move raw-TCP receipt capture, resize, ESC/POS rasterization, and socket sending from JavaScript into a local Expo module on Android and iOS. Preserve the current JavaScript raw-TCP path as the fallback throughout rollout.

## Scope and boundaries

Only printers whose driver is `rawTcp` participate. Epson SDK printing and simulator printing keep their existing paths and behavior. The native module never returns a complete receipt buffer to JavaScript.

The module exposes a typed `print` API that accepts a native React view tag, host, port, printer width, and copy count. It returns native phase timing (`capture`, `resize`, `raster`, `send`, `total`), output metadata, and structured, fallback-safe errors. The API deliberately exposes only comparison metadata, never ESC/POS payload bytes.

## Native pipeline

Android captures the supplied React Native view on the UI thread, normalizes its bitmap pixels to RGBA, nearest-neighbour resizes the image to an 8-dot-aligned printer width, and emits the same ESC/POS command sequence as the current JavaScript rasterizer. iOS follows the equivalent Core Graphics path. Both platforms use a queue keyed by normalized `host:port`: work for one physical printer is serial, while different printer targets can print concurrently.

The module maps failures to explicit error codes such as `MODULE_UNAVAILABLE`, `INVALID_OPTIONS`, `VIEW_NOT_FOUND`, `CAPTURE_FAILED`, `RASTER_FAILED`, `CONNECTION_FAILED`, `SEND_FAILED`, and `TIMEOUT`. JavaScript can identify whether native printing is safe to fall back from without parsing native exception text.

## Rollout control

Existing persisted application settings gain a platform-specific raw-TCP native mode:

- `js-only` is the default and sends the current JavaScript bytes.
- `native-diagnostic` still sends only JavaScript bytes. Native captures and rasters for comparison but does not connect or send; it returns an opaque digest, length, dimensions, and timings for equality logging.
- `native-enabled` sends with native first. If the module is unavailable or returns a fallback-safe failure, JavaScript sends the existing payload.

The setting is normalized on load so older installations begin in `js-only`. Native mode must remain disabled by default until fixture equality, Android receipt verification, iOS receipt verification, and timing evidence are recorded. No code change automatically promotes a platform to native-enabled.

## Equality tests

Fixtures cover black/white pixels, alpha compositing, long receipts, 58 mm (384-dot), and 80 mm (576-dot) output. JavaScript fixture expectations remain the compatibility oracle. Native-platform tests assert the same byte sequence internally; JavaScript only compares digest, byte length, final dimensions, and a named fixture result in diagnostic mode.

## Verification and delivery

TypeScript unit tests cover setting normalization, routing choice, unavailable-module fallback, and diagnostic no-send behavior. Native unit tests cover fixture compatibility and queue isolation. Prebuild and compilation validate module wiring. Physical Android and iOS verification, including visual comparison and timing records, is a release gate left pending until hardware is available.
