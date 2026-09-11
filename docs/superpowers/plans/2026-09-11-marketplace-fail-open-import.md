# Marketplace Fail-Open Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and print marketplace orders while preserving all unresolved marketplace content in notes.

**Architecture:** The marketplace draft builder produces denormalized fallback order items when catalogue resolution is unavailable and structured POS rows when it succeeds. Resolution problems become typed draft warnings and notes, while atomic database persistence remains the hard boundary. Receipt integrity compares both internal row totals and the provider financial snapshot.

**Tech Stack:** TypeScript, React Native/Expo, Node test runner, PostgreSQL/Supabase migrations

**Spec:** `docs/superpowers/specs/2026-09-11-marketplace-fail-open-import-design.md`

## Global Constraints

- Never reject an order because a product, add-on, removable ingredient, mapping, or customization cannot be resolved.
- Preserve exact provider names, quantities, prices, groups, and instructions at item and order level.
- Do not create a fake sale product.
- Existing imported orders remain status-only updates.
- Database save failures and provider detail-fetch failures remain retryable hard failures.
- Preserve unrelated worktree changes and leave all changes uncommitted.

---

### Task 1: Nullable marketplace item identity

**Files:**
- Create: `supabase/migrations/20260911140000_allow_unmatched_marketplace_order_items.sql`
- Modify: `libs/types/order.ts`
- Modify: `apps/pappas-order-management/app/pos.tsx`

**Interfaces:**
- Produces: `OrderItem.product_id: string | null`
- Consumes: the existing `order_items.product_id` foreign key and denormalized product fields

- [ ] Add a type-level regression through importer tests that accepts a null product ID.
- [ ] Compile the focused tests and confirm the new fallback-item assertions fail before production changes.
- [ ] Add `ALTER TABLE public.order_items ALTER COLUMN product_id DROP NOT NULL` and update the shared type.
- [ ] Guard POS customization editing for null-product fallback items.
- [ ] Recompile and run the focused tests.

### Task 2: Fail-open marketplace draft and import

**Files:**
- Modify: `apps/pappas-order-management/lib/marketplace-pos-order.ts`
- Modify: `apps/pappas-order-management/test/marketplace-pos-order.test.ts`

**Interfaces:**
- Produces: printable `MarketplacePosOrderDraft.cartItems` for every provider item
- Produces: order-level `resolutionNotes: string[]`
- Consumes: `savePosOrder(orderPayload, items)` with nullable `product_id`

- [ ] Add failing tests for `No tomato` without removable configuration, ordinary unmatched add-ons at both note levels, mixed unmatched products, and all-unmatched products.
- [ ] Add failing tests for catalogue, mapping, and customization-load degradation, stale product mapping behavior, and duplicate-lookup failure.
- [ ] Run the emitted marketplace tests and confirm failures are caused by blocking/skipping behavior.
- [ ] Add formatting helpers for exact marketplace item and option notes.
- [ ] Create fallback cart rows for unmatched products and remove the unmatched-content import gates.
- [ ] Convert catalogue, mapping, and per-product customization failures into resolution notes while preserving items.
- [ ] Require confidence for stale name-based mapping fallbacks and rely on the atomic uniqueness constraint if the advisory lookup fails.
- [ ] Run the focused marketplace tests until green.

### Task 3: Provider identity fallback

**Files:**
- Modify: `libs/marketplace/src/uber-eats-adapter.ts`
- Modify: `libs/marketplace/src/doordash-adapter.ts`
- Modify: `libs/marketplace/test/uber-eats-adapter.test.ts`
- Modify: `libs/marketplace/test/doordash-adapter.test.ts`

**Interfaces:**
- Produces: active-order `orderId` falling back to workflow/order UUID
- Consumes: provider active rows that have a detail workflow UUID

- [ ] Add failing provider-specific tests for missing display order IDs with valid workflow UUIDs.
- [ ] Confirm both tests fail because the active rows are filtered out.
- [ ] Add provider-specific identity fallback without sharing provider parsers.
- [ ] Run the complete marketplace library suite.

### Task 4: Marketplace-aware print integrity

**Files:**
- Modify: `apps/pappas-order-management/lib/order-print-integrity.ts`
- Modify: `apps/pappas-order-management/test/order-print-integrity.test.ts`

**Interfaces:**
- Produces: `getOrderPrintIntegrityWarning(order)` warning for third-party provider/POS total mismatch
- Consumes: `order.marketplace_gross_sales`, `order.order_channel`, and existing internal total fields

- [ ] Add a failing test where local items and local total agree but marketplace gross sales differs.
- [ ] Confirm the test fails with no warning.
- [ ] Compare marketplace gross sales to POS total only for third-party orders, using the existing one-cent tolerance.
- [ ] Verify matching marketplace totals and non-marketplace orders remain unchanged.

### Task 5: Final verification

**Files:**
- Review all files above plus `apps/pappas-order-management/providers/PrinterAutomationProvider.tsx`

**Interfaces:**
- Confirms: automatic imports always contain at least one item whenever provider detail contains an item

- [ ] Compile tests to a fresh temporary output directory and run marketplace importer and print-integrity tests.
- [ ] Run `pnpm --filter @my-small-business/marketplace test`.
- [ ] Run `git diff --check` and inspect the scoped diff.
- [ ] Run the full POS test/typecheck command and report the known printer-native baseline separately if it remains.
- [ ] Confirm no unrelated worktree files changed and no commit was created.
