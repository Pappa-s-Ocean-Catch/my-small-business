import assert from 'node:assert/strict';
import test from 'node:test';

import { CUSTOMER_QUEUE_SELECT, getOpenOrderLookbackStart } from '../src/lib/customer-queue';

test('selects the customer queue fields including public item details', () => {
  assert.equal(CUSTOMER_QUEUE_SELECT, 'id,order_number,created_at,scheduled_pickup_at,order_status,payment_status,customer_name,total,order_items(id,product_name,quantity,subtotal,order_item_addons(id,addon_item_name,addon_item_price))');
});

test('uses the existing 14-day open-order lookback window', () => {
  assert.equal(getOpenOrderLookbackStart(Date.parse('2026-09-16T00:00:00.000Z')), '2026-09-02T00:00:00.000Z');
});
