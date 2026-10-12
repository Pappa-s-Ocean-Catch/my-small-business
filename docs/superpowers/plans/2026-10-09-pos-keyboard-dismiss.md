# POS Keyboard Dismissal Implementation Plan

> **Status: reverted on 2026-10-09 at the user's request.** The inline Hide keyboard controls and their supporting props/imports were removed. This document retains the original plan and implementation history; it does not describe current shipped behavior. The native navigation-bar alternative has not been implemented.

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. No delegation is required for this small change.

**Goal:** Give tablet users a reliable way to hide the software keyboard throughout POS without changing text entry or business behavior.

**Architecture:** Add explicit React Native Paper buttons calling `Keyboard.dismiss()` to existing field groups. Keep existing inputs, keyboard types, form state, and event handlers. Use an optional flag only where a shared component must expose the control specifically to POS.

**Tech Stack:** React Native 0.81.5, React Native Paper 5, Expo 54, TypeScript; existing dependencies only.

**Spec:** The bounded design and acceptance criteria are recorded below; user request: “just extend the keyboard not create any breaking change.” This document is a plan, not authorization to publish an update.

## Design and Global Constraints

- Add the exact visible label **Hide keyboard**, with the existing `keyboard-close` icon. Its only effect is `Keyboard.dismiss()`; retain the current draft and keep its dialog open.
- Preserve Enter/newline behavior in every multiline field, including item notes, order notes, delivery instructions, quick-note lists, and reward adjustment reasons. Do not add `submitBehavior="blurAndSubmit"` or replace Enter with Done there.
- Preserve keyboard types, capitalization, autofocus, validation, search timing, field values, save/cancel behavior, payment actions, and custom POS keyboards.
- Do not force a different keyboard app, install dependencies, wrap inputs in a new input abstraction, or change app-wide keyboard/window configuration.
- Place the control above its field group so it can be reached while typing. Use existing button styles and touch targets; check visibility with the actual tablet keyboard open before calling the fix verified.
- Preserve existing scroll/tap behavior. Do not change `keyboardShouldPersistTaps` globally; a gesture or tap behavior change requires separate evidence and scope.
- Preserve current Android mirror edits and unrelated workspace changes. This work concerns the React Native POS app, not `pos-mirror-android`.
- Do not claim zero risk from code review alone. Acceptance requires device checks below.

## Review Focus

1. Multiline notes containing multiple lines: Enter still inserts a newline; hiding the keyboard preserves every character.
2. Numeric keyboards without a Done key: dismissal is reachable with percentage/fixed-amount inputs focused.
3. Landscape tablet with a large or fullscreen keyboard: the dismissal control remains reachable; disable Android fullscreen input only on affected fields if device verification shows it obscures the control.
4. Search followed by dismissal: current query/results remain intact; existing item/customer selection behavior is preserved.
5. Dialog dismissal and refocusing: Hide keyboard does not save or close; tapping the field reopens the keyboard normally.

## Task 1: Main POS Entry Points

**Modify:**
- `apps/pappas-order-management/components/pos/PosDialogs.tsx`: item-note and discount/coupon dialog groups.
- `apps/pappas-order-management/components/pos/PosMenuPane.tsx`: menu-search field group.
- `apps/pappas-order-management/components/pos/PosInstoreCheckoutForm.tsx`: order-note group.
- `apps/pappas-order-management/components/pos/PosPickupCheckoutForm.tsx`: order-note group.
- `apps/pappas-order-management/components/pos/PosDeliveryCheckoutForm.tsx`: address/instructions group and order-note group.
- `apps/pappas-order-management/components/pos/PosThirdPartyCheckoutForm.tsx`: customer-name/external-ID group and order-note group.

**Interfaces:** Existing props and handlers remain unchanged. Buttons consume `Keyboard.dismiss(): void` from React Native; they introduce no new form state.

- [ ] Record baseline manual behavior on the affected tablet: multiline Enter, draft text, search query, validation, and dialog actions. Reproduce inability to hide the keyboard without closing the flow.
- [ ] In the existing uncommitted item-note fix, remove the added `returnKeyType="done"`, `submitBehavior="blurAndSubmit"`, and `onSubmitEditing` props. Restore the original Save, Cancel, and dialog-dismiss handlers; keep the explicit Hide keyboard button. Evaluate the already-added `disableFullscreenUI` against the baseline device behavior rather than spreading it to every input.
- [ ] Add explicit dismissal buttons above the remaining groups listed above; use one control per nearby field group rather than one per input. Leave every input and existing action handler otherwise intact.
- [ ] Verify review-focus cases 1, 2, 3, and 5 for the item-note and discount dialogs. Verify case 4 for menu search. Check all four checkout note fields plus delivery instructions, address search, and third-party name/ID.
- [ ] Compare before/after input props and handlers in the diff. Confirm no changes to validation, order/payment logic, draft persistence, or keyboard types.

## Task 2: POS Customer Search and Settings

**Modify:**
- `apps/pappas-order-management/components/customers/CustomerDirectoryList.tsx`: optional POS-specific dismissal control in both the loading and results branches.
- `apps/pappas-order-management/components/pos/PosCustomerSelector.tsx`: enable that control for the POS customer picker.
- `apps/pappas-order-management/app/pos-layout-settings.tsx`: controls above the layout/name/quick-notes section, category-label editor, and virtual-group dialog.
- `apps/pappas-order-management/components/CustomerModal.tsx`: control above the reward amount/reason field group used from customer/order screens.

**Interfaces:** Add `showKeyboardDismissControl?: boolean` to the existing `CustomerDirectoryList` props. Default to `false`; POS passes `true`. Other callers retain their existing UI and behavior.

- [ ] Verify the actual call sites before editing; do not modify the unused `CustomerInfoModal.tsx` or existing custom phone/name/cash keyboards.
- [ ] Add the optional customer-search control to both render branches without remounting the Searchbar or altering search/loading state. Enable it at the POS call site only.
- [ ] Add dismissal controls to the listed settings and reward field groups, preserving multiline Enter and current Save/Cancel handlers.
- [ ] Verify review-focus cases 3 and 4 in customer search during loading and after results arrive. Confirm query retention and customer selection after hiding the keyboard.
- [ ] Verify cases 1 and 5 in quick-note settings and reward reasons. Save a fixture with several newline-separated quick-note options and confirm the same options are retained. Confirm other CustomerDirectoryList callers show no new control by default.

## Task 3: Verification and Release Handoff

- [ ] Run `git diff --check`; expect no whitespace errors. Review the final diff for scope and unintended changes.
- [ ] Run `pnpm --filter pappas-order-management exec tsc --noEmit`. Current baseline is blocked by missing implicit `minimatch` types; if unchanged, also run with `--types node,react` and compare diagnostics to the baseline. Expect no new diagnostics in edited files; do not silently treat a failing project check as a pass.
- [ ] Run `pnpm --filter pappas-order-management test:unit`. Prior baseline: 274 passed and 5 failed: marketplace-local-client, marketplace-sync, pos-cache-settings, pos-mirror-publisher, printer-routing. Record current results and investigate any newly introduced failure. Avoid source-text tests or new tests that only mirror trivial button wiring.
- [ ] Complete the device matrix: affected Android tablet in landscape and portrait where supported, a tablet keyboard with Done, and the app's existing custom keyboards. Check each modified field group with the keyboard open; verify dismissal, preserved text, refocusing, and unchanged Save/Cancel/selection behavior.
- [ ] Inspect screenshots or directly observe the smallest supported POS layout for clipped/obscured controls. If a control is unreachable, fix its local placement and repeat that check before release.
- [ ] Report files changed, checks passed/blocked, and device verification limitations. Prepare the existing POS release/update workflow only when deployment is requested; do not deploy the mirror APK for this React Native change.

## Acceptance

Every in-scope native keyboard group has a reachable Hide keyboard control. Dismissal preserves text and keeps the current flow open. Enter still inserts newlines in multiline fields. Existing validation, searches, selection, Save/Cancel, and payment behavior are unchanged. Shared-component changes are opt-in for POS. No dependencies or global keyboard configuration are added.

## Implementation Record — 2026-10-09

- Implemented the planned explicit dismissal controls in all 10 React Native files. Existing input props and business handlers are preserved; the earlier item-note Done/submit/fullscreen overrides and action wrappers were removed.
- Customer search is opt-in through `showKeyboardDismissControl`, defaulting to false; POS enables it in both loading and results states.
- Ruling: the discount dialog uses one dismissal control above the field groups, rather than inserting controls inside its horizontal input/action rows. This preserves those rows and limits added height.
- `git diff --check` passed. All 10 changed TSX files transpiled without syntax errors. An AST comparison against HEAD confirmed every original TextInput/Searchbar prop is unchanged.
- Unit suite: 274 passed, 5 failed, matching the earlier baseline. Failures: marketplace-local-client, marketplace-sync, pos-cache-settings (Settings refreshes the POS catalogue in place), pos-mirror-publisher, printer-routing.
- Default type check still fails on missing implicit minimatch types. The explicit node/react type check produces diagnostics identical to the earlier baseline, with none in the changed files.
- Independent diff review found no confirmed regressions. The affected tablet's keyboard has not been identified or tested; landscape/fullscreen input and the existing non-scrollable discount dialog require device verification before release.
- No POS deployment was performed. Device-matrix checks and rollout remain pending; implementation alone does not establish the complete acceptance criteria.
