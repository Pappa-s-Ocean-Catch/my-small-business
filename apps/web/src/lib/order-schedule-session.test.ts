import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node runner uses source extensions.
import { getSessionOrderType, getSessionSchedule, setSessionOrderType } from './order-schedule-session.ts';

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
test('returning from delivery checkout keeps its type even if the old entry key says pickup', () => {
  assert.equal(getSessionOrderType(storage({ orderType: 'delivery', order_type: 'pickup' })), 'delivery');
});
test('older delivery entry sessions still load correctly', () => {
  assert.equal(getSessionOrderType(storage({ order_type: 'delivery' })), 'delivery');
});
test('change-times navigation restores pickup and arrival times', () => {
  const session = storage({ orderType: 'delivery', pickupOption: 'scheduled', scheduledPickupAt: '2026-10-09T01:00:00Z', scheduledDeliveryAt: '2026-10-09T01:30:00Z' });
  assert.deepEqual(getSessionSchedule(session, 'delivery'), { option: 'scheduled', pickupAt: '2026-10-09T01:20:00.000Z', deliveryAt: '2026-10-09T01:30:00.000Z' });
});
test('changing order type clears previous schedules and updates both navigation keys', () => {
  const session = storage({ orderType: 'delivery', pickupOption: 'scheduled', scheduledPickupAt: '2026-10-09T01:00:00Z', scheduledDeliveryAt: '2026-10-09T01:30:00Z' });
  setSessionOrderType(session, 'pickup');
  assert.equal(session.getItem('orderType'), 'pickup');
  assert.equal(session.getItem('order_type'), 'pickup');
  assert.equal(session.getItem('scheduledPickupAt'), null);
  assert.equal(session.getItem('scheduledDeliveryAt'), null);
});
test('re-saving the same type preserves a selected schedule', () => {
  const session = storage({ orderType: 'pickup', pickupOption: 'scheduled', scheduledPickupAt: '2026-10-09T01:00:00Z' });
  setSessionOrderType(session, 'pickup');
  assert.equal(getSessionSchedule(session, 'pickup').pickupAt, '2026-10-09T01:00:00.000Z');
});
test('invalid saved schedules remain scheduled and require reselection instead of reverting to ASAP', () => {
  const session = storage({ orderType: 'delivery', pickupOption: 'scheduled', scheduledPickupAt: 'invalid' });
  assert.deepEqual(getSessionSchedule(session, 'delivery'), { option: 'scheduled', pickupAt: null, deliveryAt: null });
});
