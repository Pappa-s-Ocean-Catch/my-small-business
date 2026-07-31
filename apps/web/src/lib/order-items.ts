export function groupOrderItemsByOrderId<T extends { order_id: string }>(items: T[]): Map<string, T[]> {
  const itemsByOrderId = new Map<string, T[]>();

  for (const item of items) {
    const itemsForOrder = itemsByOrderId.get(item.order_id) ?? [];
    itemsForOrder.push(item);
    itemsByOrderId.set(item.order_id, itemsForOrder);
  }

  return itemsByOrderId;
}
