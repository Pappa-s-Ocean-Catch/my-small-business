# Shared StoreInfo Receipt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize editable business identity in Supabase and use it in a more legible customer receipt on every POS register.

**Architecture:** Extend the existing singleton `brand_settings` row, access it through a POS StoreInfo repository/query, and subscribe to updates for cross-register freshness. Keep current receipt-config values as offline fallbacks; render the shared StoreInfo in the receipt.

**Tech Stack:** Supabase migrations and realtime, Expo/React Native, TypeScript, React Query/Zustand, Node test runner.

## Global Constraints

- Keep all changes uncommitted on `main`.
- Seed legal name `T.K.O CHIPPERY PTY LTD` and ABN `20 689 326 547`.
- Existing fallback receipt contact details must continue working offline.
- StoreInfo updates synchronize across online POS registers.
- Opening hours are editable but are not printed on the customer receipt.

---

### Task 1: Extend shared BrandSettings into StoreInfo

**Files:**
- Create: `supabase/migrations/20260809000000_add_store_info_to_brand_settings.sql`
- Create: `apps/pappas-order-management/lib/store-info.ts`
- Create: `apps/pappas-order-management/test/store-info.test.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:** `StoreInfo` exposes `shopName`, `legalName`, `abn`, `addressLine1`, `addressLine2`, `phone`, `website`, `logoUrl`, `openingHours`; `normalizeStoreInfo(row)` returns safe, trimmed values with current receipt defaults.

- [ ] Write a failing test proving defaults preserve the present shop/contact values and blank/null database values cannot erase them.
- [ ] Run `pnpm --filter pappas-order-management test:unit`; expect module-not-found failure for `store-info`.
- [ ] Add nullable columns, seed the legal details with `COALESCE`, set the update timestamp trigger, and add authenticated POS read/update policies matching the existing role pattern. Implement `normalizeStoreInfo` with literal fallback values.
- [ ] Run the unit suite; expect the StoreInfo default/normalization test to pass.

### Task 2: Load, cache, and refresh StoreInfo in POS

**Files:**
- Create: `apps/pappas-order-management/hooks/useStoreInfoQuery.ts`
- Create: `apps/pappas-order-management/providers/StoreInfoProvider.tsx`
- Modify: `apps/pappas-order-management/app/_layout.tsx`
- Modify: `apps/pappas-order-management/lib/store-info.ts`

**Interfaces:** `fetchStoreInfo(): Promise<StoreInfo>` reads `brand_settings`; `saveStoreInfo(input): Promise<StoreInfo>` upserts its singleton; `useStoreInfoQuery()` supplies fallback data while loading; provider listens for `brand_settings` changes and invalidates the query.

- [ ] Write a failing repository test using a controlled Supabase client response that verifies the `brand_settings` read is normalized and the update payload uses database column names.
- [ ] Run the unit suite; expect the missing fetch/save exports failure.
- [ ] Implement fetch/save and provider subscription. Wrap `PrinterAutomationProvider` with `StoreInfoProvider` in the app layout so all receipt renderers see the same cache.
- [ ] Run the unit suite; expect the repository test to pass.

### Task 3: Add the shared StoreInfo editor to POS Settings

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/(tabs)/settings.tsx`
- Create: `apps/pappas-order-management/test/store-info-settings.test.ts`

**Interfaces:** Settings exposes an editable StoreInfo form with shop name, legal name, ABN, address lines, phone, website, logo URL, and opening hours, submitting `saveStoreInfo`.

- [ ] Write a failing behavior-level component/repository test that submits a complete StoreInfo value and asserts the persisted payload contains the user-entered legal name and ABN.
- [ ] Run the focused test; expect save action unavailable.
- [ ] Implement a separate “Store information” settings panel. Require shop name, trim optional fields, show save errors, and refetch after success.
- [ ] Run the focused test and full unit suite; expect both to pass.

### Task 4: Redesign the customer receipt using StoreInfo

**Files:**
- Modify: `apps/pappas-order-management/components/CustomerReceiptTemplate.tsx`
- Create: `apps/pappas-order-management/test/customer-receipt-store-info.test.ts`

**Interfaces:** `CustomerReceiptTemplate` consumes StoreInfo from its provider or explicit props and renders optional logo, shop/contact header, and legal company name/ABN footer. It preserves current fallback details.

- [ ] Write a failing render test asserting supplied StoreInfo legal name and ABN appear once, while order total/payment remain present.
- [ ] Run the focused test; expect it to fail before StoreInfo is consumed.
- [ ] Increase 58 mm and 80 mm typography for header, metadata, items, totals, and payment status; increase spacing; render logo only for a configured URL; render legal details in the footer; do not render opening hours.
- [ ] Run the focused test and `pnpm --filter pappas-order-management test:unit`; expect passing tests. Inspect a simulator receipt at both widths before handoff.
