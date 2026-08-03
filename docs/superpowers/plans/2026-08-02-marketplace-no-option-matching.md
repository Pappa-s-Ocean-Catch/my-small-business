# Marketplace “No …” Option Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import a marketplace `No Salt` option as its POS add-on when present, while preserving `No Tomato` ingredient removal.

**Architecture:** Reorder option resolution in the marketplace POS order service. The full normalized option first resolves an explicit add-on mapping or exact POS add-on; only options with no exact add-on match enter the existing `No`/`Without` removal branch and then the existing fuzzy add-on fallback.

**Tech Stack:** TypeScript, Node built-in test runner, Expo application unit-test TypeScript build.

## Global Constraints

- Retain the existing `normalizeMarketplaceName` normalization for every comparison.
- An exact active add-on mapping for the complete option name takes precedence over automatic matching.
- Preserve existing ingredient-mapping and removable-ingredient logic for the removal fallback.
- Do not alter database schema or marketplace mapping UI.

---

### Task 1: Prioritize exact add-on matches before option removal

**Files:**
- Modify: `apps/pappas-order-management/test/marketplace-pos-order.test.ts`
- Modify: `apps/pappas-order-management/lib/marketplace-pos-order.ts:356-421`

**Interfaces:**
- Consumes: `MarketplaceOrderDetail`, `MarketplaceMappingRecord`, `AddonGroup`, and `RemovableIngredient` already used by `createMarketplacePosOrderService`.
- Produces: unchanged `MarketplacePosOrderDraft`, with `cartItems[].addons` containing an exact `No Salt` POS add-on when available and `cartItems[].removed_ingredients` retaining existing fallback removal behavior.

- [ ] **Step 1: Write the failing regression tests**

  Add a service fixture whose `Classic Burger` customization data includes an active `No Salt` add-on and a removable `Tomato` ingredient. Import `No   Salt` and assert the save payload contains the `No Salt` add-on, does not contain a removed `Salt` ingredient, and has no error. Add a separate import with `No Tomato`, no matching `No Tomato` add-on, and assert the save payload contains `removed_ingredients: ['Tomato']`.

  Add an explicit `addon` mapping with `normalized_external_name: 'no salt'` and a POS option named `No Salt`; assert this mapped option imports before the removal branch.

- [ ] **Step 2: Run the focused test file and confirm the new test fails for the current behaviour**

  Run: `pnpm --dir apps/pappas-order-management exec tsc -p tsconfig.test.json && node --test apps/pappas-order-management/dist-test/apps/pappas-order-management/test/marketplace-pos-order.test.js`

  Expected: the `No Salt` regression fails because the current service turns it into the ingredient candidate `salt` before it constructs add-on matches.

- [ ] **Step 3: Implement the minimal matching-order change**

  In `buildMarketplacePosOrderDraft`, construct the existing full-option add-on candidates before calling `getMarketplaceRemovalCandidate`. Resolve an active add-on alias for `normalizeMarketplaceName(option.name)` first; if it points to a POS add-on, select that option. Without an alias, select only an exact normalized POS add-on at this stage. Add the selected add-on using the existing quantity and `OrderItemAddon` payload creation code.

  Only enter the existing removal path when no exact mapped or direct add-on was found. Retain the existing fuzzy add-on score threshold and unmatched-name recording when neither exact add-on nor removable ingredient resolves.

- [ ] **Step 4: Run the focused regression test file and confirm it passes**

  Run: `pnpm --dir apps/pappas-order-management exec tsc -p tsconfig.test.json && node --test apps/pappas-order-management/dist-test/apps/pappas-order-management/test/marketplace-pos-order.test.js`

  Expected: all marketplace POS order tests pass, including exact whitespace-normalized `No Salt` add-on matching and `No Tomato` removal fallback.

- [ ] **Step 5: Run the full mobile unit-test suite**

  Run: `pnpm --filter pappas-order-management test:unit`

  Expected: TypeScript compilation completes and all Node unit tests pass.

- [ ] **Step 6: Commit the production and regression-test change**

  ```bash
  git add apps/pappas-order-management/lib/marketplace-pos-order.ts apps/pappas-order-management/test/marketplace-pos-order.test.ts
  git commit -m "fix(pos): prioritize exact no-option addons"
  ```
