import type { Order, OrderItem, OrderItemAddon } from '@my-small-business/types';

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function buildItemLines(item: OrderItem): string[] {
  const lines: string[] = [];
  const qty = Math.max(1, item.quantity);

  // Main line: "2x Plain Burger  $12.00"
  const left = `${qty}x ${item.product_name}`;
  const right = formatMoney(item.subtotal);
  const totalWidth = 42;
  const spaceCount = Math.max(1, totalWidth - left.length - right.length);
  lines.push(left + ' '.repeat(spaceCount) + right);

  // Comment / special instructions
  if (item.comment && item.comment.trim().length > 0) {
    lines.push(`  Note: ${item.comment.trim()}`);
  }

  // Add-ons by group
  if (item.addons && item.addons.length > 0) {
    // Group by addon_group_id to mirror web receipts
    const byGroup = new Map<string, OrderItemAddon[]>();
    for (const addon of item.addons) {
      const list = byGroup.get(addon.addon_group_id) ?? [];
      list.push(addon);
      byGroup.set(addon.addon_group_id, list);
    }

    for (const [groupId, addons] of byGroup.entries()) {
      const groupName = addons[0]?.addon_group_name ?? 'Add-ons';
      lines.push(`  ${groupName}:`);
      for (const addon of addons) {
        const addonLeft = `   + ${addon.addon_item_name}`;
        const addonRight = addon.addon_item_price > 0 ? formatMoney(addon.addon_item_price) : '';
        if (addonRight) {
          const addonSpace = Math.max(1, totalWidth - addonLeft.length - addonRight.length);
          lines.push(addonLeft + ' '.repeat(addonSpace) + addonRight);
        } else {
          lines.push(addonLeft);
        }
      }
    }
  }

  // Removed ingredients
  if (Array.isArray(item.removed_ingredients) && item.removed_ingredients.length > 0) {
    lines.push(`  Removed: ${item.removed_ingredients.join(', ')}`);
  }

  return lines;
}

export function buildKitchenReceiptLines(order: Order): string[] {
  const lines: string[] = [];

  const ticketOrderNumber = (() => {
    const match = order.order_number?.match?.(/(\d{3,})$/);
    if (!match) return order.order_number;
    const lastSegment = match[1];
    return `1${lastSegment}`;
  })();

  lines.push(`ORDER #${ticketOrderNumber}`);
  lines.push('------------------------------');
  lines.push(order.order_type === 'delivery' ? 'DELIVERY' : 'PICKUP');

  if (order.scheduled_pickup_at) {
    lines.push(`When: ${new Date(order.scheduled_pickup_at).toLocaleString()}`);
  }

  if (order.customer_name) {
    lines.push(`Name: ${order.customer_name}`);
  }
  if (order.customer_phone) {
    lines.push(`Phone: ${order.customer_phone}`);
  }

  if (order.special_instructions) {
    lines.push('------------------------------');
    lines.push('Order Notes:');
    lines.push(order.special_instructions);
  }

  lines.push('------------------------------');
  lines.push('ITEMS:');

  (order.items ?? []).forEach((item, index) => {
    lines.push(...buildItemLines(item));
    if (index < (order.items?.length ?? 0) - 1) {
      lines.push(''); // blank line between items
    }
  });

  lines.push('------------------------------');
  lines.push(`TOTAL: ${formatMoney(order.total)}`);
  lines.push('');
  lines.push('Thank you!');

  return lines;
}