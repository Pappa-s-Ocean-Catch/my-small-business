# Marketplace POS Resolver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate blocking wizard that resolves every marketplace mismatch against valid POS choices and persists reusable mappings before entering POS checkout.

**Architecture:** The marketplace screen sends its selected marketplace detail to a new resolver route instead of POS. The resolver obtains structured unresolved entries from the marketplace import service, persists ID-backed, product-context mappings, and rebuilds the draft before placing it in the current draft store for `pos.tsx` to consume unchanged.

**Tech Stack:** Expo Router, React Native, React Native Paper, Zustand, Supabase, TypeScript/node:test.

## Global Constraints

- Keep the resolver outside `app/pos.tsx`; do not change the POS editor UI.
- Every marketplace product and modifier must resolve; no skip/continue action is available.
- Modifier choices must be active choices valid for the resolved POS product.
- Display original marketplace names, quantities, and prices; preserve marketplace line price and requested date in the eventual POS order.
- Keep all changes uncommitted for user testing.

---

### Task 1: Make mapping resolution ID- and parent-context-aware

**Files:**
- Modify: `supabase/migrations/<timestamp>_extend_marketplace_name_mappings.sql`
- Modify: `apps/pappas-order-management/lib/marketplace-pos-order.ts`
- Modify: `apps/pappas-order-management/test/marketplace-pos-order.test.ts`

**Interfaces:**
- Produces `MarketplaceResolutionIssue` records containing a marketplace line, modifier/removal type, parent marketplace product, price, and valid target candidates.
- Produces `saveMarketplaceMapping(input)` persistence contract using internal IDs plus display names.

- [ ] **Step 1: Write failing importer tests**

```ts
test('uses an add-on mapping only for its mapped marketplace product', async () => {
  // Same external add-on name resolves differently under two products.
});

test('keeps marketplace override price and requested timestamp after mappings resolve', async () => {
  // Assert cart item override_price and draft.requestedAt are marketplace values.
});
```

- [ ] **Step 2: Run the focused tests to verify the current behavior fails**

Run: `pnpm --filter pappas-order-management test:unit -- marketplace-pos-order`

- [ ] **Step 3: Add the migration and minimal importer support**

```sql
ALTER TABLE public.marketplace_name_mappings
  ADD COLUMN IF NOT EXISTS parent_normalized_external_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS internal_entity_id UUID NULL;

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_name_mappings_resolution_key
  ON public.marketplace_name_mappings (provider, entity_type, normalized_external_name, parent_normalized_external_name);
```

Use `internal_entity_id` when it belongs to the candidate set; otherwise retain the safe name fallback for old mappings. Return structured unresolved data rather than only strings.

- [ ] **Step 4: Run focused tests and type-check**

Run: `pnpm --filter pappas-order-management test:unit`

### Task 2: Add resolver state and persistence helpers

**Files:**
- Modify: `apps/pappas-order-management/stores/marketplacePosDraftStore.ts`
- Create: `apps/pappas-order-management/lib/marketplace-resolver.ts`
- Test: `apps/pappas-order-management/test/marketplace-resolver.test.ts`

**Interfaces:**
- Consumes `MarketplaceOrderDetail` and importer `MarketplaceResolutionIssue[]`.
- Produces `ResolverSession`, `saveResolution`, and `canCompleteResolution`.

- [ ] **Step 1: Write failing helper tests**

```ts
test('blocks completion while an issue is unresolved', () => {
  assert.equal(canCompleteResolution([unresolvedIssue]), false);
});

test('only exposes the selected product add-ons for an add-on issue', () => {
  assert.deepEqual(getValidTargets(issue, catalog), [expectedAddon]);
});
```

- [ ] **Step 2: Run the new test file and verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- marketplace-resolver`

- [ ] **Step 3: Implement typed session storage and Supabase upsert/delete helpers**

```ts
export async function saveMarketplaceResolution(input: SavedResolution): Promise<void> {
  await supabase.from('marketplace_name_mappings').upsert(input, {
    onConflict: 'provider,entity_type,normalized_external_name,parent_normalized_external_name',
  });
}
```

Store only serializable marketplace details and selected targets in Zustand. Do not store a POS order.

- [ ] **Step 4: Run unit tests**

Run: `pnpm --filter pappas-order-management test:unit`

### Task 3: Create the separate full-screen resolver route

**Files:**
- Create: `apps/pappas-order-management/app/marketplace-resolver.tsx`
- Modify: `apps/pappas-order-management/app/_layout.tsx`
- Modify: `apps/pappas-order-management/app/(drawer)/marketplace.tsx`

**Interfaces:**
- Consumes a `ResolverSession` from the marketplace draft store.
- Produces a fully resolved marketplace draft in the existing store, then navigates to `/pos`.

- [ ] **Step 1: Implement the blocking, step-by-step UI**

```tsx
<Text>{`${stepIndex + 1} of ${issues.length}`}</Text>
<Text>{issue.parentExternalName}</Text>
<Text>{`${issue.externalName} • ${formatMoney(issue.marketplacePrice)}`}</Text>
{validTargets.map((target) => <Button onPress={() => selectTarget(target)}>{target.name}</Button>)}
<Button disabled={!canCompleteResolution(issues)} onPress={completeResolution}>Add resolved order to POS</Button>
```

Use existing Paper cards, buttons, spacing, colors, and full-screen modal styling from the marketplace/order detail screens. Product resolution steps precede dependent modifier steps. Include a back button, but no skip button.

- [ ] **Step 2: Route unresolved Marketplace orders into the resolver**

```ts
if (draft.unresolvedIssues.length > 0) {
  setResolverSession({ orderDetail: marketplaceOrder });
  router.push('/marketplace-resolver');
  return;
}
```

If the order has no unresolved issues, preserve the direct `/pos` behavior.

- [ ] **Step 3: Verify build and run importer tests**

Run: `pnpm --filter pappas-order-management test:unit`

### Task 4: Upgrade mapping maintenance and verify the flow

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/marketplace.tsx`
- Modify: `apps/pappas-order-management/lib/marketplace-pos-order.ts`
- Test: `apps/pappas-order-management/test/marketplace-pos-order.test.ts`

**Interfaces:**
- Consumes mapping rows with `id`, `internal_entity_id`, and parent context.
- Produces deletion of a selected persisted mapping and refreshed unmatched queue.

- [ ] **Step 1: Add mapping removal controls**

```tsx
<Button mode="text" textColor="#b91c1c" onPress={() => removeMapping(mapping.id)}>
  Remove mapping
</Button>
```

Load saved mappings alongside unmatched names so accidental mappings can be removed even when no unresolved queue row remains.

- [ ] **Step 2: Verify with the targeted regression cases**

Run: `pnpm --filter pappas-order-management test:unit`

Manually test: open an unmatched marketplace order; resolve product; resolve only valid add-ons; confirm mappings save; continue to POS; confirm original marketplace prices and requested date remain; remove the mapping from Marketplace settings; reopen the same name and confirm it requires resolution again.
