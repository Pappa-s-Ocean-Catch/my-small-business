# POS Async Action Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every POS control that queries or changes remote data visibly pending and prevent duplicate invocation while that work is running.

**Architecture:** Keep pending state at the operation owner: screen-level database/API actions use their existing state; reusable controls receive explicit `loading` and `disabled` props. Start state changes synchronously before awaiting work so React Native paints the busy indicator before I/O; no loading treatment is added to local-only navigation, selection, or cart-edit actions.

**Tech Stack:** Expo Router, React Native 0.81, React Native Paper 5, TypeScript, Supabase.

## Global Constraints

- Apply only to database reads/writes and remote/API calls.
- Every pending action disables re-entry and visibly indicates progress at the triggered control.
- Preserve the user's existing main-branch workflow: do not create commits.
- Retain existing error handling and success outcomes.

---

### Task 1: Inventory and normalize existing remote action feedback

**Files:**
- Modify: POS screens and modal components with remote `onPress` handlers.
- Test: `apps/pappas-order-management/test/` unit suite.

- [ ] **Step 1: Identify remote handlers**

Search `app/` and `components/` for press handlers that call Supabase, app services, `fetch`, printer queues, or payment services. Exclude state setters and router navigation.

- [ ] **Step 2: Verify each handler enters pending state before its first await**

Confirm every handler uses `try/finally` (or an existing mutation state) so the triggered control cannot be pressed twice and is restored after an error.

- [ ] **Step 3: Add missing per-action state**

Use a boolean for one action or an identifier/string for row-level actions. Pass it to the specific `Button`/`IconButton` as both `loading` and `disabled`.

- [ ] **Step 4: Run the typecheck-backed unit suite**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: TypeScript compiles and all unit tests pass.

### Task 2: Close gaps in POS checkout and action surfaces

**Files:**
- Modify: `app/pos.tsx`, `components/pos/*.tsx`, `components/OrderDetailModal.tsx`, `components/printer/ManualPrintButton.tsx` as required by the inventory.
- Test: `apps/pappas-order-management/test/` unit suite.

- [ ] **Step 1: Add a focused failing test where a pure helper is introduced**

Only add a test for new deterministic, app-owned logic. UI-library `loading` props do not merit a source-text test.

- [ ] **Step 2: Render remote action pending feedback**

Connect each remote operation's pending state to the initiating control, including query buttons, delivery address selection, quote requests, checkout/payment, status/payment changes, and printing.

- [ ] **Step 3: Verify remote action handlers remain asynchronous**

Keep I/O awaited inside async handlers, use `void` only at React event-handler boundaries, and do not block with synchronous work before setting pending state.

- [ ] **Step 4: Run the typecheck-backed unit suite**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: TypeScript compiles and all unit tests pass.

### Task 3: Audit non-checkout POS management actions

**Files:**
- Modify: `app/(drawer)/**/*.tsx`, `app/menu-management.tsx`, `app/addons-management.tsx`, and reusable customer/marketing/marketplace components as required by the inventory.
- Test: `apps/pappas-order-management/test/` unit suite.

- [ ] **Step 1: Inspect buttons against the remote-action rule**

Confirm each database/API control has a visible pending state and each local-only control remains responsive.

- [ ] **Step 2: Implement only identified gaps**

Use the component's existing state naming/pattern where possible; otherwise introduce narrowly scoped state that is cleared in `finally`.

- [ ] **Step 3: Run targeted and full verification**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: TypeScript compiles and all unit tests pass.
