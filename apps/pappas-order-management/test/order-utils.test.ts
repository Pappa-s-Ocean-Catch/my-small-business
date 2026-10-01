import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order, OrderItemAddon } from '@my-small-business/types';
import {
  buildKitchenReceiptCopies,
  formatKitchenSectionValue,
  formatOrderPaymentMethod,
  getPaymentStatType,
  getReceiptHeader,
  groupAddons,
  isCombineProduct,
  resolveKitchenSections,
} from '../utils/orderUtils';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    order_number: 'ORD-001',
    order_channel: 'instore',
    payment_method: 'store',
    payment_method_detail: 'cash',
    ...overrides,
  } as Order;
}

function makeAddon(overrides: Partial<OrderItemAddon> = {}): OrderItemAddon {
  return {
    id: 'addon-1',
    order_item_id: 'item-1',
    addon_group_id: 'group-1',
    addon_group_name: 'Fish choice 1',
    addon_item_id: 'fried',
    addon_item_name: 'Fried',
    addon_item_price: 0,
    created_at: '2026-08-14T00:00:00.000Z',
    ...overrides,
  };
}

test('groups same-name same-price add-ons across groups within one product', () => {
  const grouped = groupAddons([
    makeAddon({ addon_group_name: 'Fish choice 1' }),
    makeAddon({ id: 'addon-2', addon_group_id: 'group-2', addon_group_name: 'Fish choice 2' }),
    makeAddon({ id: 'addon-3', addon_group_id: 'group-3', addon_group_name: 'Fish choice 3' }),
    makeAddon({ id: 'addon-4', addon_group_id: 'group-4', addon_group_name: 'Fish choice 4' }),
  ]);

  assert.deepEqual(grouped, [{
    name: 'Fried',
    group: 'Fish choice 1',
    price: 0,
    quantity: 4,
  }]);
});

test('groups same-name same-price add-ons despite surrounding name whitespace', () => {
  const grouped = groupAddons([
    makeAddon({ addon_item_name: 'Fried' }),
    makeAddon({ id: 'addon-2', addon_group_name: 'Fish choice 2', addon_item_name: ' Fried ' }),
  ]);

  assert.deepEqual(grouped, [{
    name: 'Fried',
    group: 'Fish choice 1',
    price: 0,
    quantity: 2,
  }]);
});

test('keeps same-name add-ons with different prices separate', () => {
  const grouped = groupAddons([
    makeAddon({ addon_group_name: 'Fish choice 1', addon_item_price: 0 }),
    makeAddon({ id: 'addon-2', addon_group_name: 'Fish choice 2', addon_item_price: 1.5 }),
  ]);

  assert.deepEqual(grouped, [
    { name: 'Fried', group: 'Fish choice 1', price: 0, quantity: 1 },
    { name: 'Fried', group: 'Fish choice 2', price: 1.5, quantity: 1 },
  ]);
});

test('prints mixed-section items once in every unique section without a combined section ticket', () => {
  const copies = buildKitchenReceiptCopies([
    { id: 'fried-only', section: 'Fried' },
    { id: 'mixed', section: 'Grill, Fried' },
  ]);

  assert.deepEqual(copies.map((copy) => ({
    sectionName: copy.sections[0]?.sectionName,
    itemIds: copy.sections[0]?.items.map((item) => item.id),
  })), [
    { sectionName: 'FRIED', itemIds: ['fried-only', 'mixed'] },
    { sectionName: 'GRILL', itemIds: ['mixed'] },
  ]);
});

test('classifies marketplace orders before their cash-like payment fields', () => {
  assert.equal(
    getPaymentStatType(makeOrder({
      order_channel: 'third_party',
      delivery_partner_name: 'Uber Eats',
      payment_method: 'store',
      payment_method_detail: 'cash',
    })),
    'marketplace'
  );
  assert.equal(
    getPaymentStatType(makeOrder({
      order_channel: 'third_party',
      delivery_partner_name: 'DoorDash',
      payment_method: 'store',
      payment_method_detail: null,
    })),
    'marketplace'
  );
});

test('retains direct card and cash classifications', () => {
  assert.equal(getPaymentStatType(makeOrder({ payment_method: 'online' })), 'card');
  assert.equal(getPaymentStatType(makeOrder()), 'cash');
});

test('prefers the recorded payment detail when displaying a paid order method', () => {
  assert.equal(formatOrderPaymentMethod(makeOrder({ payment_method: 'store', payment_method_detail: 'smartpay' })), 'Smartpay');
  assert.equal(formatOrderPaymentMethod(makeOrder({ payment_method: 'online', payment_method_detail: null })), 'Online');
  assert.equal(formatOrderPaymentMethod(makeOrder({ payment_method: undefined, payment_method_detail: null })), 'Not recorded');
});

test('maps supported marketplace partners to a branded delivery receipt header', () => {
  assert.deepEqual(
    getReceiptHeader(makeOrder({
      order_channel: 'third_party',
      delivery_partner_name: 'Uber Eats',
      order_type: 'pickup',
    })),
    { label: 'DELIVERY', logo: 'uber_eats' }
  );
  assert.deepEqual(
    getReceiptHeader(makeOrder({
      order_channel: 'third_party',
      delivery_partner_name: 'DoorDash',
      order_type: 'pickup',
    })),
    { label: 'DELIVERY', logo: 'doordash' }
  );
});

test('maps direct order channels to receipt labels without a logo', () => {
  assert.deepEqual(
    getReceiptHeader(makeOrder({ order_channel: 'instore' })),
    { label: 'INSTORE', logo: null }
  );
  assert.deepEqual(
    getReceiptHeader(makeOrder({ order_channel: 'phone_pickup' })),
    { label: 'PHONE PICKUP', logo: null }
  );
  assert.deepEqual(
    getReceiptHeader(makeOrder({ order_channel: 'phone_delivery' })),
    { label: 'PHONE DELIVERY', logo: null }
  );
});

test('preserves multi-section item when an add-on specifies a single section', () => {
  const copies = buildKitchenReceiptCopies([
    {
      id: 'flake-pack-1',
      section: 'Grilled, Fried',
      addons: [{ id: 'addon-1', section: 'Grilled' } as any],
    },
  ]);

  assert.deepEqual(copies.map((copy) => ({
    sectionName: copy.sections[0]?.sectionName,
    itemIds: copy.sections[0]?.items.map((item) => item.id),
  })), [
    { sectionName: 'GRILLED', itemIds: ['flake-pack-1'] },
    { sectionName: 'FRIED', itemIds: ['flake-pack-1'] },
  ]);
});

test('resolves combine product to both Grilled and Fried when add-on is Grilled and combine item (chips) is Fried or unset', () => {
  // Combine product like Flake Pack for 1, with add-on "Replace by grill fish" (Grilled),
  // and combine items (Small chips -> Fried or unset -> default to Fried)
  const sections = resolveKitchenSections(
    null,
    [{ id: 'addon-grilled', section: 'Grilled' } as any],
    null,
    ['Fried']
  );
  assert.deepEqual(sections.sort(), ['Fried', 'Grilled']);

  const formatted = formatKitchenSectionValue(
    null,
    [{ id: 'addon-grilled', section: 'Grilled' } as any],
    null,
    ['Fried']
  );
  assert.equal(formatted, 'Grilled, Fried');
});

test('resolves single item to only Grilled when replaced by grill fish', () => {
  // Non-combine item (single Flake) replaced by grilled fish should only route to Grill
  const sections = resolveKitchenSections(
    null,
    [{ id: 'addon-grilled', section: 'Grilled' } as any],
    null,
    []
  );
  assert.deepEqual(sections, ['Grilled']);
});

test('resolves combine product by product name to Grilled and Fried when section was single Grilled', () => {
  const copies = buildKitchenReceiptCopies([
    {
      id: 'flake-pack-1',
      product_name: 'Flake Pack For One',
      section: 'Grilled',
      addons: [{ id: 'addon-1', section: 'Grilled' } as any],
    },
  ]);

  assert.deepEqual(copies.map((copy) => ({
    sectionName: copy.sections[0]?.sectionName,
    itemIds: copy.sections[0]?.items.map((item) => item.id),
  })), [
    { sectionName: 'GRILLED', itemIds: ['flake-pack-1'] },
    { sectionName: 'FRIED', itemIds: ['flake-pack-1'] },
  ]);
});

test('isCombineProduct detects combine product from ingredient products list or count', () => {
  assert.equal(isCombineProduct('Custom Feast', null, 3), true);
  assert.equal(isCombineProduct('Custom Feast', null, [{ name: 'Chips' }]), true);
  assert.equal(isCombineProduct('Custom Feast', null, true), true);
  assert.equal(isCombineProduct('Flake (I)', null, 0), false);
  assert.equal(isCombineProduct('Flake (I)', null, []), false);
});

test('resolveKitchenSections extracts sections directly from ingredient products', () => {
  const sections = resolveKitchenSections(
    null,
    [{ id: 'addon-grilled', section: 'Grilled' } as any],
    null,
    null,
    {
      productName: 'Special Seafood Catch',
      ingredients: [
        { name: 'Flake (I)', section: null },
        { name: 'Small Chips', section: 'Fried' },
      ],
    }
  );
  assert.deepEqual(sections, ['Grilled', 'Fried']);
});


