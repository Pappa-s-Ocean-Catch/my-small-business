# Compact Report Tile Height Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make title-only report tiles use their content height.

**Architecture:** Remove obsolete fixed-height styles in the existing Report screen; no component or state changes.

**Tech Stack:** React Native, TypeScript, Node unit runner.

## Global Constraints

- Leave changes uncommitted.
- Preserve tile width, active styling, and information action.

---

### Task 1: Remove obsolete tile height constraints

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/report.tsx`
- Modify: `apps/pappas-order-management/test/image-only-printing.test.ts`

- [ ] Add a failing source test asserting the Report screen has no `minHeight: 168` or `minHeight: 108`.
- [ ] Run `pnpm --filter pappas-order-management test:unit` and observe failure.
- [ ] Remove both `minHeight` styles; reduce report tile padding from 16 to 12 and accent bottom margin from 14 to 8.
- [ ] Run `pnpm --filter pappas-order-management test:unit` and observe PASS.
