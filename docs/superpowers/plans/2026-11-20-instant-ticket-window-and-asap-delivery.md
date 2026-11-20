# Instant ticket hours and ASAP delivery Implementation Plan

**Goal:** Add the existing receipt-style daily schedule to instant tickets and request ASAP delivery 30 minutes after placement.
**Architecture:** Reuse receipt time normalization/window checks. Set a shared ASAP scheduling policy for quote and order payloads without using provider ETA as the deadline.
**Tech Stack:** TypeScript, React Native, node:test.
**Spec:** `docs/superpowers/specs/2026-11-20-instant-ticket-window-and-asap-delivery-design.md` (approved by user).

## Constraints and review focus

- Keep existing settings layout and toggle/printer/payment eligibility.
- Blank and equal endpoints mean all-day; overnight windows use local device time.
- Reject incomplete and invalid HH:MM settings; preserve them when reopening settings.
- Keep customer-selected scheduled times, provider ETA information and UTC rollover correct.
- User authorized implementation in the shared workspace; leave changes reviewable and uncommitted.

## Task 1: Instant ticket daily window

- [x] Add tests for default/normalized times and actual print eligibility at boundaries and overnight. Run to see failures.
- [x] Export the existing receipt time normalizer; reuse it and the existing window predicate from instant-ticket eligibility. Add optional `now` for deterministic checks and diagnostics.
- [x] Add AppSettings fields/defaults and wire settings initialization, reload, save, validation and From/To inputs.
- [x] Run instant-ticket and customer-receipt tests, then the POS unit suite.

## Task 2: ASAP requested delivery

- [x] Add schedule tests for long/short/missing ETA and midnight rollover; add actual SDK/fetch payload tests; change payment integration ASAP expectation to placement +30. Run to see failures.
- [x] Set ASAP delivery to placement +30, retain pickup +10 and explicit scheduled values. Align quote and create-delivery fallback defaults.
- [x] Run Shipday schedule/client tests and API quote/payment scheduling integration tests.

## Verification

- [x] Inspect diff, typecheck changed applications, run relevant regressions and report limitations.


## Results

- POS unit suite: 512 passed, including actual settings save/reload and legacy defaults.
- Shipday schedule/client/package tests: 15 passed.
- API delivery payment/quote/booking integration tests: 22 passed.
- API TypeScript: passed.
- Full POS TypeScript: default invocation blocked by existing missing minimatch types. With explicit react/node types, reports errors in QR code and Caller ID modules outside this change; a read-only comparison against HEAD confirms the same 13 diagnostics before and after, with no new diagnostics.
- Independent code review: no concrete correctness or regression findings.
- No deployment or device/printer smoke test was performed.
