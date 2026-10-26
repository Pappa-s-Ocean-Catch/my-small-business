# POS Full Fidelity Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Review every page family and supplied V5 state against the design exports, fix observed visual mismatches, and distinguish screenshot verification from source-only review.

**Architecture:** Shared header, dialog, form and layout primitives carry common corrections. Page-specific changes preserve existing handlers, conditional actions and production data. Native evidence comes from the running simulator; reference screenshots remain immutable.

**Tech Stack:** Expo, React Native, React Native Paper, TypeScript.

**Spec:** apps/pappas-order-management/Pappas-Redesign/DEVELOPER-HANDOFF.md, INTERACTIONS-V5.md, final screen.css and screens exports.

## Global Constraints

- Work on pos-redesigned and preserve all existing uncommitted work.
- Preserve current business logic and legitimate production buttons omitted by the designer.
- Product taps add immediately; Continue preserves same line/options/group context.
- Preview and live POS share tile configuration.
- No backend writes, real payments, marketing sends, physical prints, terminal pairing or sign-out during validation.
- Do not substitute reference fixtures for live data or certify unavailable states as native verified.

## Review Focus

- Header and modal boundaries must remain visible, full width and fixed during scrolling.
- Real long content must wrap without clipping controls or hiding conditional actions.
- Phones must retain reachable actions and scrolling forms.
- Nested dialogs must return to original context; Cancel must preserve persisted state.
- Dynamic errors/loading/feature-gated states must remain explicit and truthful.

### Task 1: Reference and evidence inventory
- [ ] Generate a page/state checklist from the supplied exports.
- [ ] Capture current native workspace screenshots and map each to a reference.
- [ ] Record source-only or unavailable states explicitly.

### Task 2: Independent page reviews
- [ ] Management reviewer owns management/settings/catalogue files and reports exact gaps.
- [ ] Orders reviewer owns orders/customers/reports files and reports exact gaps.
- [ ] Parent owns shared primitives and POS/checkout/layout families.

### Task 3: Screenshot comparison and correction
- [ ] Compare normalized native captures with corresponding design exports.
- [ ] Fix shared gaps once, page-specific gaps locally.
- [ ] Reopen/reload affected pages and capture after fixes.
- [ ] Exercise safe navigation, local draft, modal Cancel and context restoration.

### Task 4: Verification and delivery
- [ ] Review independent changes, resolve conflicts and inspect final diff.
- [ ] Run unit suite, explicit-type TypeScript, iOS/web exports and whitespace checks.
- [ ] Deliver page-by-page report with screenshot links, concrete remaining gaps and limits.
