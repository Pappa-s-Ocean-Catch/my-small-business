# Consistent Custom Dialogs Implementation Plan

**Goal:** Replace application-owned OS/browser alerts and confirmations with consistent in-app modals, preserving action semantics.
**Architecture:** A queued dialog service and themed overlay host. A shared native-modal wrapper hosts alerts above the currently visible modal; a root host covers ordinary screens. Existing callbacks, cancellation and one-tap choices remain intact. Native permission prompts, sharing sheets and terminal UI remain platform-owned.

- [x] Inventory alert signatures and existing modal nesting; preserve pending work.
- [x] Test and implement queue, action dispatch, cancellation, host selection and failure handling.
- [x] Implement accessible themed host and modal wrapper; install root host and integrate existing native modal surfaces.
- [x] Migrate all app-owned Alert calls/imports and browser confirmation calls; consolidate legacy confirmation rendering.
- [x] Test nested dialogs, duplicate taps, cancel/escape/back behavior and preservation of existing callbacks; run full suite and TypeScript comparison.
- [x] Review final diff, scan for remaining system dialogs, and document native verification limits.


Validation: 408 unit tests passed, including source-inventory guards against native Alert imports, browser confirm/alert calls and unhosted native modal windows. Store and rendered-component tests cover one-tap action dispatch, duplicate-tap suppression, queued alerts, cancellation, callback failures, topmost-host selection, inert background content and native dismissal callback forwarding. Full TypeScript check retains 13 pre-existing receipt/caller-ID diagnostics and introduces no new errors. Native visual verification remains outstanding because the available simulator is running a different project. No live transaction, status change, physical print or saved setting was triggered.
