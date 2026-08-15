# Product-Scoped Add-on Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate repeated same-name, same-price add-ons within each parent order item, regardless of their originating add-on group.

**Architecture:** Keep all display and receipt consumers on the existing `groupAddons` utility. Change only its grouping identity so the parent-item call boundary preserves product scoping while names and prices determine modifier identity.

**Tech Stack:** TypeScript, Node built-in test runner, React Native order templates.

## Global Constraints

- Do not merge add-ons across different parent order items.
- Same named add-ons with different prices remain distinct.
- Do not commit changes; work directly on the current branch.

---

### Task 1: Cover and implement product-scoped grouping

**Files:**
- Modify: `apps/pappas-order-management/test/order-utils.test.ts`
- Modify: `apps/pappas-order-management/utils/orderUtils.ts:7-34`

**Interfaces:**
- Consumes: `groupAddons(addons: OrderItemAddon[])`.
- Produces: grouping that combines entries matching `addon_item_name` and `addon_item_price` without considering `addon_group_name`.

- [ ] **Step 1: Write the failing test**

```ts
test('groups same-name same-price add-ons across groups within one product', () => {
  const grouped = groupAddons([
    makeAddon({ addon_group_name: 'Fish 1', addon_item_name: 'Fried', addon_item_price: 0 }),
    makeAddon({ addon_group_name: 'Fish 2', addon_item_name: 'Fried', addon_item_price: 0 }),
  ]);

  assert.deepEqual(grouped, [{ name: 'Fried', group: 'Fish 1', price: 0, quantity: 2 }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: the new test fails because the current grouping key includes `addon_group_name`.

- [ ] **Step 3: Write minimal implementation**

```ts
const key = `${addon.addon_item_name}-${addon.addon_item_price}`;
```

Keep the existing per-array call boundary and output shape unchanged.

- [ ] **Step 4: Run test suite to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: all unit tests pass.

- [ ] **Step 5: Leave changes uncommitted**

Do not run `git commit`; report the modified files and verification result.
