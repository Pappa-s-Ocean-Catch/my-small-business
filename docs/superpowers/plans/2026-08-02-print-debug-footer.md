# Print Debug Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task.

**Goal:** Add a toggleable kitchen-ticket debug footer showing POS identity, trigger, routing, and effective print settings.

**Architecture:** Persist device-local register/debug settings with existing app settings. Carry immutable diagnostic context from print trigger through section routing into ReceiptTemplate, rendering only when enabled.

## Global Constraints

- Debug footer defaults off.
- Kitchen tickets only; customer receipts unchanged.
- Display only; no changes to printing claims, routing, retries, or copies.

### Task 1: Persist diagnostic settings

- Modify `apps/pappas-order-management/lib/settings.ts`
- Modify `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx`
- Add unit coverage if settings test harness exists.

- [ ] Add failing test/contract for `registerName: string` and `printerDebugFooter: boolean` defaults.
- [ ] Add load/save validation, default false, and Settings register-name input plus debug toggle.
- [ ] Verify settings build/type and commit.

### Task 2: Carry and render print diagnostics

- Modify `apps/pappas-order-management/providers/PrinterAutomationProvider.tsx`
- Modify `apps/pappas-order-management/components/ReceiptTemplate.tsx`
- Modify the manual/reprint print pathways that render ReceiptTemplate.
- Add focused template/context test.

- [ ] Add failing test proving debug footer is absent when disabled and includes trigger, route, printer target, copies, register/device/session, settings, and timestamp when enabled.
- [ ] Build immutable diagnostic context per queued section job using its actual route/printer/copies and trigger.
- [ ] Render compact footer only for kitchen ReceiptTemplate when debug enabled.
- [ ] Run unit tests, TypeScript check, diff check; record unrelated baseline errors; commit.

### Task 3: Final verification

- [ ] Recheck each spec requirement against actual printed-context data flow.
- [ ] Run `pnpm --filter pappas-order-management test:unit && git diff --check`.

