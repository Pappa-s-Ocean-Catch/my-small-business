import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { Order } from '@my-small-business/types';
import {
  buildInstoreInstantTicketDocument,
  getInstoreInstantTicketDebugDetails,
  getInstoreInstantTicketPrintJob,
  normalizeInstoreInstantTicketSettings,
} from '../lib/instore-instant-ticket';
import { buildDocumentPrintJob } from '../lib/escpos-document';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    order_number: 'ORD-001',
    order_channel: 'instore',
    payment_method: 'store',
    items: [],
    ...overrides,
  } as Order;
}

test('defaults instant tickets to disabled with no target', () => {
  assert.deepEqual(normalizeInstoreInstantTicketSettings(null), {
    instoreInstantTicketEnabled: false,
    instoreInstantTicketPrinterTarget: null,
  });
});

test('routes enabled in-store store orders only to a saved printer', () => {
  const settings = {
    instoreInstantTicketEnabled: true,
    instoreInstantTicketPrinterTarget: 'TCP:192.168.1.20',
  };

  assert.deepEqual(getInstoreInstantTicketPrintJob(makeOrder({ payment_status: 'paid' }), settings, ['TCP:192.168.1.20']), {
    printerTarget: 'TCP:192.168.1.20',
    priority: 'instant-ticket',
  });
  assert.equal(getInstoreInstantTicketPrintJob(makeOrder({ order_channel: 'phone_pickup', payment_status: 'paid' }), settings, ['TCP:192.168.1.20']), null);
  assert.equal(getInstoreInstantTicketPrintJob(makeOrder({ payment_method: 'online', payment_status: 'paid' }), settings, ['TCP:192.168.1.20']), null);
  assert.equal(getInstoreInstantTicketPrintJob(makeOrder({ payment_status: 'paid' }), settings, []), null);
});

test('does not route a pending in-store payment to the instant-ticket printer', () => {
  assert.equal(
    getInstoreInstantTicketPrintJob(makeOrder({ payment_status: 'pending' }), {
      instoreInstantTicketEnabled: true,
      instoreInstantTicketPrinterTarget: 'TCP:192.168.1.20',
    }, ['TCP:192.168.1.20']),
    null,
  );
});

test('reports the exact instant ticket eligibility inputs for the print journal', () => {
  assert.equal(
    getInstoreInstantTicketDebugDetails(makeOrder({ order_channel: 'phone_pickup', payment_status: 'paid' }), {
      instoreInstantTicketEnabled: true,
      instoreInstantTicketPrinterTarget: 'TCP:192.168.1.20',
    }, ['TCP:192.168.1.20']),
    'enabled=true target=TCP:192.168.1.20 saved=true channel=phone_pickup method=store payment=paid eligible=false',
  );
});

test('creates a text-only ticket without customisations', () => {
  const doc = buildInstoreInstantTicketDocument(makeOrder({
    order_number: 'ORD-123',
    created_at: '2026-08-14T10:30:00.000Z',
    total: 42.5,
    payment_status: 'pending',
    items: [{
      product_name: 'Fish Burger',
      quantity: 2,
      comment: 'No salt',
      addons: [{ addon_item_name: 'Cheese' }],
    }] as Order['items'],
  }));
  const text = doc.nodes.map((node) => node.type === 'text' ? node.text : '').join('\n');

  assert.match(text, /ORDER #P123/);
  assert.match(text, /ORDER TIME: 2026-08-14 10:30/);
  assert.match(text, /ITEMS: 2/);
  assert.match(text, /TOTAL: \$42\.50/);
  assert.match(text, /PAYMENT: PENDING/);
  assert.match(text, /Fish Burger/);
  assert.doesNotMatch(text, /No salt|Cheese/);
  assert.deepEqual(doc.nodes[0], {
    type: 'text',
    text: 'ORDER #P123',
    style: { align: 'center', bold: true, widthScale: 2, heightScale: 2 },
    newline: true,
  });
  assert.deepEqual(doc.nodes[1], { type: 'text', text: 'ORDER TIME: 2026-08-14 10:30', newline: true });
  assert.deepEqual(doc.nodes[2], { type: 'feed', lines: 2 });
  assert.deepEqual(doc.nodes.at(-1), { type: 'cut', partial: false });
  const bytes = buildDocumentPrintJob(doc);
  assert.equal(bytes.includes(0x2a), false);
});

test('does not invoke the iOS-crashing raw Epson command bridge', () => {
  assert.doesNotMatch(source('lib/escpos-printer.ts'), /device\.addCommand\(/);
});

test('preserves document newline nodes for Epson text printing', () => {
  assert.match(
    source('lib/escpos-printer.ts'),
    /device\.addText\(node\.newline !== false \? `\$\{node\.text\}\\n` : node\.text\)/,
  );
});
