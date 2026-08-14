import assert from 'node:assert/strict';
import test from 'node:test';
import type { Order } from '@my-small-business/types';
import {
  buildInstoreInstantTicketDocument,
  getInstoreInstantTicketDebugDetails,
  getInstoreInstantTicketPrintJob,
  normalizeInstoreInstantTicketSettings,
} from '../lib/instore-instant-ticket';
import { buildDocumentPrintJob } from '../lib/escpos-document';

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

  assert.deepEqual(getInstoreInstantTicketPrintJob(makeOrder(), settings, ['TCP:192.168.1.20']), {
    printerTarget: 'TCP:192.168.1.20',
    priority: 'instant-ticket',
  });
  assert.equal(getInstoreInstantTicketPrintJob(makeOrder({ order_channel: 'phone_pickup' }), settings, ['TCP:192.168.1.20']), null);
  assert.equal(getInstoreInstantTicketPrintJob(makeOrder({ payment_method: 'online' }), settings, ['TCP:192.168.1.20']), null);
  assert.equal(getInstoreInstantTicketPrintJob(makeOrder(), settings, []), null);
});

test('reports the exact instant ticket eligibility inputs for the print journal', () => {
  assert.equal(
    getInstoreInstantTicketDebugDetails(makeOrder({ order_channel: 'phone_pickup' }), {
      instoreInstantTicketEnabled: true,
      instoreInstantTicketPrinterTarget: 'TCP:192.168.1.20',
    }, ['TCP:192.168.1.20']),
    'enabled=true target=TCP:192.168.1.20 saved=true channel=phone_pickup method=store eligible=false',
  );
});

test('creates a text-only ticket without customisations', () => {
  const doc = buildInstoreInstantTicketDocument(makeOrder({
    order_number: 'ORD-123',
    items: [{
      product_name: 'Fish Burger',
      comment: 'No salt',
      addons: [{ addon_item_name: 'Cheese' }],
    }] as Order['items'],
  }));
  const text = doc.nodes.map((node) => node.type === 'text' ? node.text : '').join('\n');

  assert.match(text, /ORDER #P123/);
  assert.match(text, /Fish Burger/);
  assert.doesNotMatch(text, /No salt|Cheese/);
  assert.deepEqual(doc.nodes[0], {
    type: 'text',
    text: 'ORDER #P123',
    style: { align: 'center', widthScale: 2, heightScale: 2 },
    newline: true,
  });
  assert.deepEqual(doc.nodes[1], { type: 'feed', lines: 1 });
  assert.deepEqual(doc.nodes.at(-1), { type: 'cut', partial: false });
  const bytes = buildDocumentPrintJob(doc);
  assert.equal(bytes.includes(0x2a), false);
});
