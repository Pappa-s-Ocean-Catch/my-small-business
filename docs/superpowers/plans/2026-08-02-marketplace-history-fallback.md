# Marketplace History Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reconcile locally open marketplace orders through provider history after they leave the active list.

**Architecture:** Store provider workflow UUID at import, query open local marketplace orders each poll, and history-fetch only those missing from their provider's active set. The existing status-only updater remains the only write path for existing orders.

**Tech Stack:** Expo/React Native, TypeScript, Supabase/PostgreSQL, Node tests.

## Global Constraints

- Poll remains foreground-only at 30 seconds.
- Existing orders update only `order_status`.
- Fallback never inserts orders or overwrites staff/imported fields.
- Fallback applies only to non-terminal third-party orders with a workflow UUID.

### Task 1: Persist workflow UUID and query eligible fallback orders

**Files:**
- Modify: `libs/types/order.ts`
- Create: `supabase/migrations/20260802140000_add_marketplace_workflow_uuid.sql`
- Modify: `apps/pappas-order-management/lib/marketplace-pos-order.ts`
- Modify: `apps/pappas-order-management/lib/orders.ts`
- Modify: `apps/pappas-order-management/test/marketplace-pos-order.test.ts`

- [ ] Write a failing test that a new marketplace import persists its workflow UUID and a status-only existing-order update does not change it.
- [ ] Run `pnpm --filter pappas-order-management test:unit` and confirm RED.
- [ ] Add nullable `marketplace_workflow_uuid` to `orders` and the shared type; save `detail.orderUUID` only in new import payloads. Add an orders query returning open third-party rows with provider, external ID, workflow UUID, and status.
- [ ] Run unit tests and `git diff --check`; commit.

### Task 2: Add history reconciliation to the sync coordinator

**Files:**
- Modify: `apps/pappas-order-management/lib/marketplace-sync.ts`
- Modify: `apps/pappas-order-management/providers/MarketplaceSyncProvider.tsx`
- Modify: `apps/pappas-order-management/test/marketplace-sync.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

- [ ] Write failing tests proving an absent active order with workflow UUID is fetched with `mode: 'history'` and only status sync is called; terminal/no-UUID orders are skipped; history failure does not prevent other orders.
- [ ] Run the unit suite and confirm RED.
- [ ] Extend coordinator dependencies with eligible local orders and status-only synchronization. Compare each provider's active external IDs using trimmed identity, process only missing local orders, fetch history details with its workflow UUID, and call status-only update.
- [ ] Mount dependencies in the provider; run unit tests, full TypeScript check (record baseline blocker if present), and diff check; commit.

### Task 3: Final verification

- [ ] Run `pnpm --filter pappas-order-management test:unit && pnpm --filter pappas-order-management exec tsc -p tsconfig.json --noEmit && git diff --check`.
- [ ] Confirm every requirement in the approved design against the diff and report remaining baseline type-check failures separately.

