# POS redesign implementation plan

**Goal:** Implement the supplied Pappas-Redesign v2 native UI on branch pos-redesigned, sharing presentation and preserving production workflows.
**Spec:** apps/pappas-order-management/Pappas-Redesign/DEVELOPER-HANDOFF.md, SCREEN-COVERAGE.md, TAKE-ORDER-V2.md, ORDERS-TABS-V2.md and design-tokens.json.
**Architecture:** Existing Expo routes, services and state remain authoritative. A shared native design system provides tokens, Paper theme, responsive sizing and reusable presentation. Apply the supplied visual hierarchy to existing screens, without copying sample data.
**Tech Stack:** Expo Router, React Native, React Native Paper, TypeScript.

## Global constraints
- Native system font, navy #122E40, primary #087F82, background #F4F6F5; semantic colors from supplied JSON.
- Compact below 600dp, medium 600–1099dp, expanded 1100dp+. 48dp controls, 52dp primary actions, safe-area-aware navigation.
- Preserve data, routes, auth, catalogue, discounts, payment, printing and integration semantics.
- Reuse shared components. No production records or external communications changed. No source files deleted.

## Review focus
- Small/split-view windows must use single-pane POS when cart leaves less than 300dp.
- Draft identity and uncommitted modifiers must survive resize/back; confirmation updates exact cart line.
- Upcoming tab uses confirmed/cached count, never an error-as-zero fallback.
- Native editors retain all existing fields and validation with scrollable bodies/actions.
- Rendering changes must preserve financial effects and guarded asynchronous actions.

## Task 1: Shared foundation (controller)
- [x] Create theme/tokens and shared native UI in components/ui and lib/redesign.
- [x] Wire Paper theme, brand and responsive layout; test boundary sizing.
- [x] Integrate shared presentation across remaining dialogs and customer components.

## Task 2: Take Order and checkout (POS implementer)
- [x] Restyle app/pos.tsx and components/pos with group/product/modifier hierarchy and cart review.
- [x] Implement explicit confirm/cancel of modifier drafts; retain existing calculations and stable line IDs.
- [x] Apply same controls and panel language to checkout and cash tender.
- [x] Verify group search, optional modifiers, edit without duplicate, and compact/tablet sizing.

## Task 3: Shell and Orders (navigation implementer)
- [x] Implement responsive rail/bottom navigation with existing route destinations and More.
- [x] Persistent Live/On the way/Completed plus conditional cached Pre-orders tab.
- [x] Restyle order lists/cards/details with shared headers, metrics, status and actions.
- [x] Preserve filters, actions, printing, list settings and async states.

## Task 4: Management screens (management implementer)
- [x] Apply supplied design to customers, marketing/coupons, delivery/marketplace, reports, catalogue/POS layout, settings/about/TV/login.
- [x] Reuse shared components for repeated panels/metrics/headers; keep forms/fields/actions intact.
- [x] Preserve full route and screen-state coverage.

## Task 5: Integration and verification (controller)
- [x] Run unit suite, full TypeScript check and web export; distinguish baseline failures.
- [x] Review design coverage against screen inventory and fix integration issues.
- [x] Verify browser startup/login at 375×812 and 1366×1024. Authenticated device screenshots remain acceptance work.
- [x] Report exact verified scope and any unavailable integration/device checks.

## Decisions
- User supplied a complete designer brief and requested implementation; use it as the approved visual design.
- Work in the requested branch in the current checkout; preserve untracked design and artifacts.
- Parallel tasks have disjoint file ownership; shared UI API is fixed before dispatch.
