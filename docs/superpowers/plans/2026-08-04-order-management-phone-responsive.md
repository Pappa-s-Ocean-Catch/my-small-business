# Order Management Phone Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all Order Management routes, dialogs, and POS checkout flows usable and scrollable on portrait phones without changing their landscape/tablet workflows.

**Architecture:** Add an app-local responsive helper for one compact breakpoint and reusable layout choices, then migrate screens in coherent route groups. Each screen retains its current React Native and React Native Paper components, selecting compact styles from `useWindowDimensions` rather than introducing a global CSS override.

**Tech Stack:** Expo Router, React Native, React Native Paper, TypeScript, Node test runner.

## Global Constraints

- Compact portrait breakpoint: widths below 600 logical pixels.
- Every over-height page, list, form, and modal has a vertical scroll owner.
- Compact primary actions, tabs, filters, and chips use single-line labels with truncation or a horizontal rail.
- Long detail values may wrap only within a vertically scrollable parent.
- Preserve landscape/tablet composition and all business behavior.
- Work directly on `main` and leave every change uncommitted.

---

### Task 1: Establish responsive primitives

**Files:**
- Create: `apps/pappas-order-management/lib/responsive.ts`
- Create: `apps/pappas-order-management/test/responsive.test.ts`

**Interfaces:**
- Produces `isCompactWidth(width: number): boolean` and `compactLabelProps` for compact one-line text.
- Consumed by each route/component migrated in later tasks.

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { isCompactWidth } from '../lib/responsive';

test('uses the compact layout below 600 logical pixels', () => {
  assert.equal(isCompactWidth(599), true);
  assert.equal(isCompactWidth(600), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter pappas-order-management test responsive.test.ts`
Expected: failure because `lib/responsive.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export const COMPACT_WIDTH = 600;
export const isCompactWidth = (width: number) => width < COMPACT_WIDTH;
export const compactLabelProps = { numberOfLines: 1, ellipsizeMode: 'tail' as const };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter pappas-order-management test responsive.test.ts`
Expected: PASS.

### Task 2: Make app shell and order lists compact-safe

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/_layout.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/_layout.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/orders.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/completed.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/live-orders.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/on-the-way.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/pre-orders.tsx`
- Modify: `apps/pappas-order-management/components/HistoryOrderListItem.tsx`
- Modify: `apps/pappas-order-management/components/LiveOrderListItem.tsx`

- [ ] **Step 1: Add failing renderer assertions for the narrow list header and item styles**

Assert that compact order headers expose a vertical/reflowed action group and that item metadata has `flexShrink: 1` rather than a fixed width.

- [ ] **Step 2: Run the focused order tests and record failures**

Run: `pnpm --filter pappas-order-management test order-detail-layout.test.ts live-order-window.test.ts`
Expected: failing assertions for compact layout exports.

- [ ] **Step 3: Implement compact tab rails, reflowed headers, and scroll-safe lists**

Use `isCompactWidth(width)` to switch header/action groups to wrapping or vertical layouts. Keep date tabs and filters horizontal `ScrollView` rails with one-line labels. Add `flexShrink: 1` and compact margins to list metadata.

- [ ] **Step 4: Run focused list tests**

Run: `pnpm --filter pappas-order-management test order-detail-layout.test.ts live-order-window.test.ts`
Expected: PASS.

### Task 3: Make POS and checkout flows portrait-safe

**Files:**
- Modify: `apps/pappas-order-management/app/pos.tsx`
- Modify: `apps/pappas-order-management/components/pos/pos.styles.ts`
- Modify: `apps/pappas-order-management/components/pos/PosMenuPane.tsx`
- Modify: `apps/pappas-order-management/components/pos/PosCartPane.tsx`
- Modify: `apps/pappas-order-management/components/pos/PosCheckoutPanel.tsx`
- Modify: `apps/pappas-order-management/components/pos/PosPickupCheckoutForm.tsx`
- Modify: `apps/pappas-order-management/components/pos/PosInstoreCheckoutForm.tsx`
- Modify: `apps/pappas-order-management/components/pos/PosDeliveryCheckoutForm.tsx`
- Modify: `apps/pappas-order-management/components/pos/PosThirdPartyCheckoutForm.tsx`
- Modify: `apps/pappas-order-management/components/pos/PosCustomerSelector.tsx`
- Modify: `apps/pappas-order-management/components/pos/PosDialogs.tsx`

- [ ] **Step 1: Add failing tests for compact breakpoint-driven POS pane selection**

Cover a 375-pixel width selecting a column body and a 768-pixel width retaining the two-pane body.

- [ ] **Step 2: Run the POS-focused tests to verify failure**

Run: `pnpm --filter pappas-order-management test marketplace-pos-order.test.ts marketplace-pos-import.test.ts`
Expected: failing compact layout assertion.

- [ ] **Step 3: Implement scroll ownership and compact pane composition**

Stack menu, cart, and checkout in portrait; remove fixed compact heights/minimum widths; ensure product names, cart lines, checkout tabs, payment choices, and dialog action labels have controlled single-line text or a horizontal rail. Preserve nested list scrolling only where it remains bounded by its pane.

- [ ] **Step 4: Run POS-focused tests**

Run: `pnpm --filter pappas-order-management test marketplace-pos-order.test.ts marketplace-pos-import.test.ts`
Expected: PASS.

### Task 4: Make management, customer, and settings screens scroll-safe

**Files:**
- Modify: `apps/pappas-order-management/app/menu-management.tsx`
- Modify: `apps/pappas-order-management/app/addons-management.tsx`
- Modify: `apps/pappas-order-management/app/pos-layout-settings.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/menu.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/settings.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/customers.tsx`
- Modify: `apps/pappas-order-management/components/CustomerModal.tsx`
- Modify: `apps/pappas-order-management/components/CustomerInfoModal.tsx`
- Modify: `apps/pappas-order-management/components/customers/AddCustomerModal.tsx`
- Modify: `apps/pappas-order-management/components/customers/CustomerDirectoryList.tsx`

- [ ] **Step 1: Add failing tests for compact modal/page scroll style selection**

Cover a compact screen selecting bounded modal content and a page selecting vertical content padding.

- [ ] **Step 2: Run customer and settings tests to verify failure**

Run: `pnpm --filter pappas-order-management test customer-profile.test.ts print-debug-settings.test.ts`
Expected: failing compact layout assertions.

- [ ] **Step 3: Implement compact forms, stacked cards, and bounded modal scrolling**

Replace desktop-only rows and fixed widths with compact stacks. Put long editor and customer form content in scroll containers, and use single-line labels for controls.

- [ ] **Step 4: Run customer and settings tests**

Run: `pnpm --filter pappas-order-management test customer-profile.test.ts print-debug-settings.test.ts`
Expected: PASS.

### Task 5: Make reporting, marketplace, marketing, and print/order overlays compact-safe

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/report.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/marketplace.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/marketing.tsx`
- Modify: `apps/pappas-order-management/app/order-detail.tsx`
- Modify: `apps/pappas-order-management/components/OrderDetailModal.tsx`
- Modify: `apps/pappas-order-management/components/OrderFiltersModal.tsx`
- Modify: `apps/pappas-order-management/components/PrintLogsModal.tsx`
- Modify: `apps/pappas-order-management/components/PrintSimulatorModal.tsx`
- Modify: `apps/pappas-order-management/lib/PendingOnlinePaymentsOverlay.tsx`

- [ ] **Step 1: Add failing tests for compact report and overlay layouts**

Cover narrow report rows reflowing into cards and fixed overlays exposing a scrollable body.

- [ ] **Step 2: Run affected existing tests to verify failure**

Run: `pnpm --filter pappas-order-management test marketplace-order-summary.test.ts print-debug-footer.test.ts image-only-printing.test.ts`
Expected: failing compact layout assertions.

- [ ] **Step 3: Implement compact statistic cards, horizontal rails, and modal body scrolling**

Reflow dense report/marketing/marketplace row layouts, remove phone-breaking minimum widths, and bound every overlay with a vertically scrollable body and reachable footer actions.

- [ ] **Step 4: Run affected tests**

Run: `pnpm --filter pappas-order-management test marketplace-order-summary.test.ts print-debug-footer.test.ts image-only-printing.test.ts`
Expected: PASS.

### Task 6: Verify type safety and portrait layouts

**Files:**
- Modify: only files required by verification findings.

- [ ] **Step 1: Run the full app test suite**

Run: `pnpm --filter pappas-order-management test`
Expected: PASS.

- [ ] **Step 2: Run app typecheck**

Run: `pnpm --filter pappas-order-management typecheck`
Expected: PASS.

- [ ] **Step 3: Inspect the app at 320, 375, and 414 portrait widths**

Use the Expo web target and visit each route. Verify vertical scrolling, no unintentional horizontal clipping, reachable modal footers, and single-line compact labels.

- [ ] **Step 4: Review the working tree**

Run: `git diff --check && git status --short`
Expected: no whitespace errors and only intended uncommitted responsive work.
