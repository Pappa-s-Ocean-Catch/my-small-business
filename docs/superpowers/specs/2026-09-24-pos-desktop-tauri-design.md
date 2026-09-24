# Pappas POS Desktop for macOS and Windows

## Goal

Add a production desktop POS application for macOS and Windows that preserves the current POS workflows and Supabase-backed data contracts while delivering a desktop-appropriate operator experience. The desktop app will run alongside, not replace, the existing Expo Android/iOS POS.

The chosen architecture is a new Tauri v2 application with a React DOM frontend. It will reuse shared TypeScript business-domain code and backend contracts, while each operating-system capability is accessed through a small desktop adapter.

## Non-goals

- Convert the Expo app itself into a Tauri application or make the existing React Native UI the desktop production UI.
- Change order, pricing, promotion, payment, marketplace, delivery, staff authorization, printing eligibility, or POS Mirror business rules.
- Make an offline-first, independently authoritative POS in the first release.
- Support every USB/Bluetooth printer protocol in the initial release.
- Ship untested payment-terminal, caller-ID, or physical-printer support.

## Product Boundary

The first desktop release targets a staffed counter or back-office computer with a stable network connection. It must support the normal staff sign-in, catalogue browsing/search, cart/customisation, order save/edit, cash/card/SmartPay flows, Live Orders, printing, reports, settings, and existing Supabase Realtime synchronization.

Android/iOS remain supported. A desktop register has its own persistent register identity and settings but operates on the same orders, catalogue, staff roles, live order state, and mirror-state backend data. Desktop failures in optional hardware, background sync, or POS Mirror publication must never block cart editing, order persistence, checkout, payment reconciliation, or navigation.

## Application Layout

Create `apps/pappas-order-management-desktop` with:

- React + TypeScript + Vite for the desktop renderer;
- Tauri v2 and a minimal Rust backend for desktop capabilities;
- a desktop router and desktop component library, designed for mouse, keyboard, touch displays, and wide counter screens;
- browser-compatible Supabase client/session storage behind an interface; and
- Tauri commands/events as the only renderer-to-OS bridge.

The existing `apps/pappas-order-management` stays Expo-native. It keeps its Expo router, React Native Paper UI, Android/iOS modules, native printer pipeline, caller-ID module, and EAS release path.

## Shared Domain and Platform Boundary

Extract only side-effect-free POS logic into workspace packages. Initial candidates are catalogue/index normalization, cart calculations, promotions, checkout-state rules, payment-transition validation, order payload construction, order-status rules, Live Order selection/formatting, printer routing decisions, receipt/ESC-POS document construction, SmartPay HTTP payload/response parsing, and POS Mirror safe projections.

The shared packages must not import `react-native`, Expo, Tauri, DOM globals, or storage/network implementation modules. Platform apps provide explicit ports:

```text
PosPlatformServices
  storage: SecureStore
  printer: PrinterService
  notifications: NotificationService
  files: FileService
  callerId: CallerIdService
  appLifecycle: AppLifecycleService
```

Each port returns typed success/failure results. Domain code does not know which operating system performs the work. Existing native behavior is first adapted behind these interfaces before desktop uses them, avoiding duplicated checkout and print rules.

## Data, Authentication, and Realtime

Desktop uses the current Supabase project, authenticated staff roles, RLS policies, RPCs, and API routes. The initial release is online-first:

- authenticate using the existing staff login flow;
- persist the Supabase session using desktop secure storage, never plain-text application files;
- hydrate the full POS catalogue after staff access is confirmed, using the approved shared in-memory catalogue model;
- use Supabase Realtime for catalogue invalidation, Live Orders, print automation, and POS Mirror state; and
- retain the current order mutation/RPC atomicity requirements.

On first catalogue hydration failure, menu checkout controls are unavailable with a retryable error. During a later refresh, retain the last complete snapshot. On loss of connectivity, retain already-loaded data but visibly show that network-backed operations cannot safely complete; do not pretend orders, payments, or prints were saved.

Desktop register identity uses the existing SmartPay `posRegisterId` semantics, generated once and stored in the desktop secure store. Do not reuse a mobile device's identifier by default. POS Mirror continues to publish through the shared safe projection and must remain fail-open.

## Desktop UI and Interaction

The desktop UI reproduces POS information architecture and rules, not native layouts verbatim. It provides:

- an adaptive counter layout: order/cart, menu, and live queue may be visible concurrently on wide displays;
- 48px minimum primary touch targets while retaining efficient mouse and keyboard operation;
- keyboard shortcuts for product search, quantity changes, discount-authorized actions, checkout, and safe dismissal;
- clear keyboard focus, no accidental checkout shortcut, and an explicit confirmation for destructive/financial actions;
- a full-screen/kiosk option, window-size persistence, and a normal resizable desktop window; and
- explicit loading, empty, stale/offline, failure, and in-progress payment/print states.

The app must never use browser `alert()` or a web-only print dialog for POS-critical flows. Modal and notification behavior is implemented in the desktop UI layer.

## Hardware and OS Adapters

### Printing

The first supported physical-printer path is LAN raw TCP ESC/POS on configured IP/port, including the current per-printer queue, printer routing, text/image document modes, copy limits, receipt eligibility, and failure reporting. Tauri invokes a scoped Rust command; Rust validates the selected saved-printer configuration, opens the socket, sends a deterministic ESC/POS document, closes it, and returns structured diagnostics.

Receipt rendering moves from React Native view capture to a desktop print-renderer contract. Prefer semantic ESC/POS document commands for text receipts. Where the existing layout needs raster output, generate the receipt image deterministically in the renderer or Rust process and pass only validated bytes/options across the Tauri boundary. No arbitrary shell/process access is exposed to the renderer.

Epson SDK/Bluetooth printer support is deferred unless a certified desktop SDK path is selected. The desktop app must show an unsupported-driver state rather than reporting a print as successful.

### SmartPay

Retain the existing SmartPay cloud HTTP workflow and order/payment sequencing. Replace mobile storage only; do not move a terminal approval into a local desktop-only state. Every result must still write the authoritative payment status through the existing atomic backend contract before post-payment printing. Physical terminal pairing and real approval/decline/timeout testing are release gates.

### Caller ID, Notifications, Files, and Updates

Caller-ID is a later capability. Its Android/iOS Expo module is not portable. If desktop caller-ID is required, implement a separately tested Rust UDP/SIP listener with the existing validation, lifecycle, deduplication, and non-blocking floating-card contract.

Desktop notifications, settings export/import, secure persistence, logs, updater, single-instance behavior, and window state use narrowly permissioned Tauri APIs. The updater only installs signed release artifacts after an explicit user-triggered request or a separately approved policy. Browser/renderer code receives no unrestricted file-system, process, or network privileges.

## Security

- Tauri capabilities grant only the commands and file paths each window needs.
- All privileged commands validate inputs and return redacted errors; no auth tokens, SmartPay credentials, receipts with payment data, or customer PII are written to logs.
- Supabase RLS remains the authorization boundary; desktop does not embed a service-role credential.
- Register settings, session data, and pairing identifiers use OS-backed secure storage where available.
- Production macOS artifacts are code-signed/notarized and Windows installers code-signed.

## Delivery Phases

### Phase 0: Compatibility audit and contracts

Inventory imports in the Expo POS and classify them as shared domain, renderer-specific UI, Android/iOS-only capability, or desktop capability. Establish contract tests around existing checkout, order mutations, printer routing/eligibility, SmartPay, and POS Mirror projection before extraction.

### Phase 1: Desktop online vertical slice

Bootstrap Tauri, desktop authentication/session persistence, catalogue hydration, POS menu/search/cart, order save, and cash/card checkout. Prove that a desktop order is visible immediately to existing mobile POS clients through Supabase Realtime.

### Phase 2: Operational POS parity

Add customisations/promotions, edit/reopen flows, Live Orders, marketplace order handling, customer history, delivery management, reports, settings backup/import, POS Mirror publication, notifications, and desktop interaction/accessibility behavior.

### Phase 3: Certified peripherals

Implement/configure raw TCP ESC/POS print, section routing, print queue/retry/diagnostics, receipt rendering, and SmartPay physical terminal validation. Add caller-ID only if it is confirmed as a desktop requirement.

### Phase 4: Release hardening

Add installers, code signing/notarization, controlled updates, audit-safe logs, crash reporting, smoke-test fixtures, and an explicit supported hardware matrix. Pilot with one Windows and one macOS register before broad deployment.

## Testing and Release Gates

Shared-domain unit tests run once against platform-neutral code. Desktop tests include React component/interaction tests, Tauri command tests, and end-to-end smoke tests for sign-in, catalogue load, cart, order save, realtime update, setting persistence, and error handling.

Physical verification is required on both Windows and macOS for each supported printer model/network condition, SmartPay approved/declined/timeout paths, startup/restart, updater, Realtime recovery, high-DPI/touch display behavior, and kiosk/window behavior. Focused TypeScript tests or a successful desktop build do not prove device/peripheral behavior.

Rollout begins with a pilot register. Maintain a rollback path to the existing mobile POS, publish only signed artifacts, and do not mark a hardware driver supported until the physical matrix passes.

## Acceptance Criteria

1. Staff can operate a desktop register on macOS and Windows using the same authenticated Supabase data and business rules as the existing POS.
2. No core mobile POS flow regresses as shared logic is extracted.
3. A desktop-created/updated order reconciles correctly on active mobile clients and the POS Mirror.
4. Printer and SmartPay success are only shown after their authoritative outcome; failures are actionable and never create duplicate orders.
5. Unsupported hardware is disabled with an explicit status, not silently emulated or treated as successful.
6. Production installers are signed, desktop permissions are least-privilege, and no sensitive credentials are logged or bundled.
