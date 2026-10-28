# Marketplace Alarms Implementation Plan

**Goal:** Independently configurable Uber Eats and DoorDash alarms, with no dropped overlapping sound sequences.
**Architecture:** Extend device settings and existing realtime sound routing; reuse bundled sound picker and serialize playback.
**Spec:** docs/superpowers/specs/2026-10-28-marketplace-alarms-design.md

- [x] Add failing tests for marketplace settings normalization, independent source routing, and overlapping playback.
- [x] Implement pure marketplace sound settings/routing in lib/order-sound-settings.ts; persist through lib/settings.ts and route from PrinterAutomationProvider.tsx without changing printing/status logic.
- [x] Serialize sounds.ts playback and verify playback failures release the queue.
- [x] Add independent settings editor states, picker, preview, validation, cancel restoration and persistence in app/(drawer)/(tabs)/settings.tsx.
- [x] Run unit suite, compare TypeScript diagnostics with baseline, inspect new settings in simulator without saving or modifying live data, and document results.


Verification: 376 unit tests passed, including real settings loader/saver against isolated storage and the actual provider realtime callback against mocked subscriptions. Simulator checked both alarm editors, sound picker, preview action and Cancel restoration; no settings saved or order/payment/print actions performed. Full TypeScript check retains the same 13 pre-existing receipt/caller-ID errors and introduces none in the changed files. `git diff --check` passed. Audible output on physical hardware and a real incoming marketplace order remain untested.
