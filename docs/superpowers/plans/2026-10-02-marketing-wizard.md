# Marketing Wizard Implementation Plan

**Goal:** Simplify marketing into Campaign → Recipients → Review & send.
**Architecture:** Preserve campaign and selection state in the existing React Native screen. Add pure recipient-history helpers and a marketing-specific paginated customer loader so sorting covers more than the latest 500 customers.
**Tech Stack:** React Native Paper, TypeScript, Supabase, node:test.
**Spec:** Approved in-chat design, 2026-10-02; user requested planning and implementation together.

## Constraints
Preserve separate email/SMS send actions, existing API contract, opt-out protection, and unrelated workspace changes. Never contacted means neither channel has recorded marketing delivery.

## Tasks
- [x] Add failing tests for history filters, never-contacted priority, eligible selection, and bulk removal.
- [x] Implement pure helpers in lib/marketing-audience.ts; verify tests.
- [x] Add marketing-specific customer loading with stable pagination over the entire matching customer summary.
- [x] Replace simultaneous panels with a three-step wizard; preserve state and validate campaign/recipient transitions.
- [x] Use one selectable recipient table, history chips, clear sort labels, and page-scoped selection.
- [x] Add review summary, paginated recipients, individual removal, checkbox bulk removal, and final send actions.
- [x] Run unit suite and type checking; review diff for stale requests, opted-out customers, failed sends, empty selections, and narrow layouts.

## Verification and review
- Nine marketing tests pass, covering history filters, priority, contact eligibility, immutable bulk removal, pagination beyond 500, partial-load errors, and per-channel retry behavior.
- `git diff --check` passes.
- App type checking with explicit `--types node,react` reports no diagnostics in changed marketing/customer files. The app has 26 unrelated diagnostics; default type checking additionally stops on the existing missing minimatch type definition.
- `npm run test:unit` stops at `libs/pos-mirror/test/customer-queue.test.ts:11` (optional id incompatible with CustomerQueueCandidate).
- Running the emitted full test suite reports five unrelated failures: marketplace-local-client (module resolution), marketplace-sync (alias resolution), pos-cache-settings / Settings refreshes the POS catalogue in place (missing emitted settings source), pos-mirror-publisher (ES module parsing), printer-routing (alias resolution).
- Independent code review identified pending generation changing copy after review and email send removing pending SMS recipients; both fixed. Navigation is locked during generation, successful IDs are tracked per channel, failed sends remain retryable, and refresh reconciles selected recipient eligibility.
- UI was not exercised on a live device; no actual campaigns were sent.

## Implementation decisions
- User explicitly requested planning and implementation together; execution proceeded inline without another approval handoff.
- Preserve the existing customer loaders for other screens; marketing alone fetches all summary pages and filters locally, using stable field ordering.
- Narrow screens use stacked customer rows in either orientation; wizard controls and filters wrap.

## Step 2 refinement
- Replaced inline contact/history/sort controls with one compact summary row and a filter icon.
- A single native modal now contains contact requirements, send history, sorting, and sort direction; its body scrolls within 90% of screen height.
- Settings are drafted on open; Apply commits them, while Cancel, close, and Android Back discard them.
- Default send history is Never emailed; default sort remains Never contacted first.
- Verification: nine existing marketing tests pass; diff whitespace check passes; no marketing diagnostics in app type check (unrelated project errors remain). Live-device modal verification remains outstanding.
