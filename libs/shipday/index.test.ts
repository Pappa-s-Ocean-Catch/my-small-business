import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node runner uses source extensions.
import { getShipdayClient } from './index.ts';

test('order creation sends the future date and both UTC clock times', async () => {
  process.env.SHIPDAY_API_KEY = 'test';
  const client = getShipdayClient();
  let payload: any;
  // Replace the external SDK transport only; exercise the actual payload builder.
  (client as any).sdk.orderService.insertOrder = async (request: any) => {
    payload = request.getRequestBody();
    return { orderId: 1 };
  };
  await client.createDelivery({ customer_name: 'Test', customer_email: 'test@example.com', customer_phone: '0400000000', delivery_address: 'Melton', placed_at: '2026-10-08T00:00:00Z', expected_pickup_at: '2026-10-09T01:00:00Z', expected_delivery_at: '2026-10-09T01:30:00Z' });
  assert.equal(payload.expectedDeliveryDate, '2026-10-09');
  assert.equal(payload.expectedPickupTime, '01:00:00');
  assert.equal(payload.expectedDeliveryTime, '01:30:00');
});
test('scheduled availability sends pickup and delivery instants', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let payload: any;
  globalThis.fetch = async (_url, options) => {
    payload = JSON.parse(String(options?.body));
    return new Response(JSON.stringify([{ fee: 10, name: 'Test', deliveryDuration: 30 }]), { status: 200 });
  };
  const address = { address_line1: 'Test', city: 'Melton', state: 'VIC', postcode: '3337' };
  await getShipdayClient().requestQuote(address, address, { pickup_at: '2026-10-09T01:00:00Z', delivery_at: '2026-10-09T01:30:00Z' });
  assert.equal(payload.pickUpTime, '2026-10-09T01:00:00Z');
  assert.equal(payload.deliveryTime, '2026-10-09T01:30:00Z');
});


test('ASAP creation fallback requests delivery 30 minutes after placement across midnight', async () => {
  process.env.SHIPDAY_API_KEY = 'test';
  const client = getShipdayClient();
  let payload: any;
  (client as any).sdk.orderService.insertOrder = async (request: any) => {
    payload = request.getRequestBody();
    return { orderId: 1 };
  };
  await client.createDelivery({ customer_name: 'Test', customer_email: 'test@example.com', customer_phone: '0400000000', delivery_address: 'Melton', placed_at: '2026-11-20T23:40:00Z' });
  assert.equal(payload.expectedDeliveryDate, '2026-11-21');
  assert.equal(payload.expectedPickupTime, '23:50:00');
  assert.equal(payload.expectedDeliveryTime, '00:10:00');
});

test('ASAP availability requests pickup in 10 minutes and delivery in 30 minutes', async (t) => {
  process.env.SHIPDAY_API_KEY = 'test';
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  t.after(() => { globalThis.fetch = originalFetch; Date.now = originalNow; });
  const now = Date.parse('2026-11-20T23:40:00Z');
  Date.now = () => now;
  let payload: any;
  globalThis.fetch = async (_url, options) => {
    payload = JSON.parse(String(options?.body));
    return new Response(JSON.stringify([{ fee: 10, name: 'Test', deliveryDuration: 50 }]), { status: 200 });
  };
  const address = { address_line1: 'Test', city: 'Melton', state: 'VIC', postcode: '3337' };
  const quote = await getShipdayClient().requestQuote(address, address);
  assert.equal(payload.pickUpTime, '2026-11-20T23:50:00.000Z');
  assert.equal(payload.deliveryTime, '2026-11-21T00:10:00.000Z');
  assert.equal(quote.estimated_duration_minutes, 50);
});
