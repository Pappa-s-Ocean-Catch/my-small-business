# Batched Order Item Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load order items for the filtered admin-order result in one database query instead of one query per order.

**Architecture:** Keep filters and sorting in `getAllOrders`. Add a small pure helper to group item rows by `order_id`, and use one `.in('order_id', orderIds)` query before mapping `Order` objects.

**Tech Stack:** Next.js server actions, Supabase JavaScript client, TypeScript, Node test runner.

## Global Constraints

- Preserve `getAllOrders`'s existing `Order[]` return shape and ordering.
- Do not move item grouping to the client.
- Skip the items query when no orders match the filters.

---

### Task 1: Batch and attach order items

**Files:**
- Create: `apps/web/src/lib/order-items.ts`
- Create: `apps/web/src/lib/order-items.test.ts`
- Modify: `apps/web/src/app/actions/orders.ts:993-1025`

**Interfaces:**
- Produces: `groupOrderItemsByOrderId(items)` returning `Map<string, OrderItem[]>`.
- Consumes: the `order_items` rows returned by Supabase.

- [ ] **Step 1: Write the failing test**

```ts
test('groups order items by order ID and includes orders with no items', () => {
  const grouped = groupOrderItemsByOrderId([
    { id: 'item-1', order_id: 'order-a' },
    { id: 'item-2', order_id: 'order-b' },
    { id: 'item-3', order_id: 'order-a' },
  ]);

  assert.deepEqual(grouped.get('order-a')?.map((item) => item.id), ['item-1', 'item-3']);
  assert.deepEqual(grouped.get('order-b')?.map((item) => item.id), ['item-2']);
  assert.equal(grouped.get('order-c'), undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test apps/web/src/lib/order-items.test.ts`

Expected: FAIL because `groupOrderItemsByOrderId` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function groupOrderItemsByOrderId<T extends { order_id: string }>(items: T[]) {
  const itemsByOrderId = new Map<string, T[]>();
  for (const item of items) {
    const itemsForOrder = itemsByOrderId.get(item.order_id) ?? [];
    itemsForOrder.push(item);
    itemsByOrderId.set(item.order_id, itemsForOrder);
  }
  return itemsByOrderId;
}
```

- [ ] **Step 4: Update `getAllOrders`**

Replace the per-order `order_items` loop queries with one query using `.in('order_id', orders.map(order => order.id))`, order its rows by `created_at`, group them with `groupOrderItemsByOrderId`, and attach `itemsByOrderId.get(order.id) ?? []` during the existing order mapping.

- [ ] **Step 5: Run tests and type-check**

Run: `node --experimental-strip-types --test apps/web/src/lib/order-items.test.ts && pnpm --filter web exec tsc --noEmit`

Expected: both commands exit with status 0.
