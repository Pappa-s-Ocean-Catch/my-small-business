import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order } from '@my-small-business/types';
import type { EscPosDocument } from '../lib/instore-instant-ticket';
import { buildKitchenReceiptDocument } from '../lib/kitchen-receipt-document';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    order_number: 'ORD-123',
    created_at: '2026-08-15T10:30:00.000Z',
    order_channel: 'phone',
    order_type: 'pickup',
    payment_method: 'online',
    payment_status: 'paid',
    items: [],
    subtotal: 20,
    total: 22,
    tax: 2,
    ...overrides,
  } as Order;
}

function documentText(order: Order): string {
  const document: EscPosDocument = buildKitchenReceiptDocument(order, {
    paperWidth: '80mm',
    showTicketCounter: false,
    duplicateBySections: false,
    printDebugContext: null,
  });
  return document.nodes.filter((node) => node.type === 'text').map((node) => node.text).join('\n');
}

test('builds a complete text kitchen receipt', () => {
  const document: EscPosDocument = buildKitchenReceiptDocument(makeOrder({
    customer_name: 'Ada Lovelace',
    scheduled_pickup_at: '2026-08-15T18:30:00.000Z',
    items: [{
      product_name: 'Fish Burger',
      quantity: 2,
      comment: 'No salt',
      removed_ingredients: ['Onion'],
      addons: [
        { addon_item_name: 'Cheese', addon_item_price: 1, addon_group_name: 'Extras' },
        { addon_item_name: 'Cheese', addon_item_price: 1, addon_group_name: 'Extras' },
      ],
    }] as unknown as Order['items'],
  }), {
    paperWidth: '80mm',
    showTicketCounter: false,
    duplicateBySections: false,
    printDebugContext: null,
  });
  const text = document.nodes.filter((node) => node.type === 'text').map((node) => node.text).join('\n');

  assert.match(text, /\*\*\* PRE-ORDER \*\*\*/);
  assert.match(text, /Ada Lovelace/);
  assert.match(text, /2x FISH BURGER/);
  assert.match(text, /No Onion/);
  assert.match(text, /2x Cheese \(\$1\.00\)/);
  assert.match(text, /Notes: No salt/);
  assert.match(text, /TOTAL:/);
  assert.match(text, /P123/);
  assert.deepEqual(document.nodes.at(-2), { type: 'feed', lines: 3 });
  assert.deepEqual(document.nodes.at(-1), { type: 'cut', partial: false });
  const addonNode = document.nodes.find((node) => node.type === 'text' && node.text.includes('Cheese'));
  assert.deepEqual(addonNode, { type: 'text', text: '  2x Cheese ($1.00)', style: { bold: true }, newline: true });
  const customerNode = document.nodes.find((node) => node.type === 'text' && node.text === '----- Ada Lovelace -----');
  assert.equal(customerNode, undefined);
});

test('puts customer name and phone in a full-width divider section', () => {
  const document = buildKitchenReceiptDocument(makeOrder({
    customer_name: 'Ada Lovelace',
    customer_phone: '0400 123 456',
  }), { paperWidth: '80mm', duplicateBySections: false, printDebugContext: null });
  const customerDivider = '-'.repeat(48);
  const textNodes = document.nodes.filter((node) => node.type === 'text');
  const firstDividerIndex = textNodes.findIndex((node) => node.text === customerDivider);

  assert.notEqual(firstDividerIndex, -1);
  assert.deepEqual(textNodes.slice(firstDividerIndex, firstDividerIndex + 4), [
    { type: 'text', text: customerDivider, style: undefined, newline: true },
    { type: 'text', text: 'Ada Lovelace', style: { align: 'center', bold: true }, newline: true },
    { type: 'text', text: '0400 123 456', style: { align: 'center', bold: true }, newline: true },
    { type: 'text', text: customerDivider, style: undefined, newline: true },
  ]);
});

test('prints order notes, item notes, and integrity warnings at normal text height', () => {
  const document = buildKitchenReceiptDocument(makeOrder({
    special_instructions: 'Call on arrival',
    subtotal: 25,
    total: 25,
    tax: 0,
    items: [{ product_name: 'Burger', quantity: 1, subtotal: 10, comment: 'No onion' }] as unknown as Order['items'],
  }), { paperWidth: '80mm', duplicateBySections: false, printDebugContext: null });
  const textNodes = document.nodes.filter((node): node is Extract<EscPosDocument['nodes'][number], { type: 'text' }> => node.type === 'text');

  assert.deepEqual(textNodes.find((node) => node.text === 'ORDER NOTES:'), {
    type: 'text', text: 'ORDER NOTES:', style: { bold: true }, newline: true,
  });
  assert.deepEqual(textNodes.find((node) => node.text === 'Call on arrival'), {
    type: 'text', text: 'Call on arrival', style: undefined, newline: true,
  });
  assert.deepEqual(textNodes.find((node) => node.text === 'Notes: No onion'), {
    type: 'text', text: 'Notes: No onion', style: { bold: true }, newline: true,
  });
  assert.deepEqual(textNodes.find((node) => node.text.startsWith('WARNING: ORDER TOTAL')), {
    type: 'text',
    text: 'WARNING: ORDER TOTAL DOES NOT MATCH ITEMS —',
    style: { bold: true, invert: true },
    newline: true,
  });
});

test('includes delivery contact and fulfilment details', () => {
  const text = documentText(makeOrder({
    order_type: 'delivery',
    customer_name: 'Grace Hopper',
    customer_phone: '0400 123 456',
    delivery_address_line1: '1 Main Street',
    delivery_address_line2: 'Unit 2',
    delivery_city: 'Melbourne',
    delivery_state: 'VIC',
    delivery_postcode: '3000',
    delivery_status: 'on_the_way',
    delivery_driver_name: 'Sam',
    delivery_driver_phone: '0400 456 789',
    delivery_driver_pin: '1234',
    delivery_vehicle_info: 'Blue Toyota',
    delivery_instructions: 'Leave at door',
  }));

  assert.match(text, /Grace Hopper/);
  assert.match(text, /Delivery Address:|1 Main Street|Unit 2|Melbourne VIC 3000/);
  assert.match(text, /Driver: Sam|Driver Phone: 0400 456 789|Driver PIN: 1234|Vehicle: Blue Toyota|Instructions: Leave at door/);
});

test('uses a large marketplace name instead of receipt dividers for delivery text receipts', () => {
  const document = buildKitchenReceiptDocument(makeOrder({
    order_channel: 'third_party',
    order_type: 'delivery',
    delivery_partner_name: 'DoorDash',
  }), { paperWidth: '80mm', duplicateBySections: false, printDebugContext: null });
  const text = document.nodes.filter((node) => node.type === 'text').map((node) => node.text).join('\n');

  assert.deepEqual(document.nodes[0], {
    type: 'text', text: 'DOORDASH', style: { align: 'center', bold: true, heightScale: 2 }, newline: true,
  });
  assert.doesNotMatch(text, /---|\.\.\./);
});

test('formats the receipt time without seconds using uppercase AM or PM', () => {
  const document = buildKitchenReceiptDocument(makeOrder(), {
    paperWidth: '80mm', duplicateBySections: false, printDebugContext: null,
  });
  const timestamp = document.nodes.find((node) => node.type === 'text' && /\d{1,2}:\d{2}/.test(node.text));

  assert.ok(timestamp && timestamp.type === 'text');
  assert.match(timestamp.text, /\d{1,2}:\d{2} (AM|PM)$/);
  assert.doesNotMatch(timestamp.text, /\d{1,2}:\d{2}:\d{2}/);
});

test('uses a full-width dotted, bold section heading and an underscore price divider', () => {
  const document = buildKitchenReceiptDocument(makeOrder({
    items: [
      { product_name: 'Fish', quantity: 1, section: 'Fried' },
      { product_name: 'Salad', quantity: 1, section: 'Till' },
    ] as unknown as Order['items'],
  }), { paperWidth: '80mm', duplicateBySections: false, printDebugContext: null });
  const sectionHeadings = document.nodes.filter((node): node is Extract<EscPosDocument['nodes'][number], { type: 'text' }> => (
    node.type === 'text' && /FRIED|TILL/.test(node.text)
  ));
  assert.deepEqual(sectionHeadings.map((node) => node.text), [
    '.'.repeat(21) + 'FRIED' + '.'.repeat(22),
    '.'.repeat(22) + 'TILL' + '.'.repeat(22),
  ]);
  assert.ok(sectionHeadings.every((node) => node.type === 'text' && node.style?.bold));
  assert.ok(document.nodes.some((node) => node.type === 'text' && node.text === '_'.repeat(48)));
  assert.equal(document.nodes.some((node) => node.type === 'text' && node.text.includes('=')), false);
});

test('uses a hyphen between an item and price without alignment padding', () => {
  const document = buildKitchenReceiptDocument(makeOrder({
    items: [
      { product_name: 'First Burger', quantity: 1, subtotal: 14.9 },
      { product_name: 'Second Burger', quantity: 1, subtotal: 12.5 },
    ] as unknown as Order['items'],
  }), { paperWidth: '80mm', duplicateBySections: false, printDebugContext: null });
  const firstItemIndex = document.nodes.findIndex((node) => node.type === 'text' && node.text.startsWith('1x FIRST BURGER'));
  const firstItem = document.nodes[firstItemIndex];

  assert.deepEqual(firstItem, {
    type: 'text', text: '1x FIRST BURGER - $14.90', style: { bold: true, doubleStrike: true }, newline: true,
  });
  assert.equal((firstItem as Extract<typeof firstItem, { type: 'text' }>).text.includes('  $'), false);
  assert.deepEqual(document.nodes[firstItemIndex + 1], { type: 'feed', lines: 1 });
});
