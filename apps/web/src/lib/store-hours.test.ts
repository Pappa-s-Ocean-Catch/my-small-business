import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node test runner uses source extensions.
import { getPickupTimeSlots, isPickupTimeWithinHours } from './store-hours.ts';

test('slots use Melbourne dates even on a UTC server and exclude elapsed slots', () => {
  const slots = getPickupTimeSlots({ '4': { open: '10:00', close: '21:00' } }, new Date('2026-10-08T00:00:00Z'), { numDays: 1 });
  assert.equal(slots[0].date, '2026-10-08');
  assert.equal(slots[0].slots[0].value, '2026-10-08T00:15:00.000Z');
});
test('overnight slots land on the following calendar day', () => {
  const slots = getPickupTimeSlots({ '4': { open: '22:00', close: '02:00' } }, new Date('2026-10-07T13:00:00Z'), { numDays: 2 });
  assert.equal(slots.flatMap((day: { slots: { label: string; value: string }[] }) => day.slots).find((slot: { label: string }) => slot.label === '00:00')?.value, '2026-10-08T13:00:00.000Z');
});
test('after midnight uses the previous day overnight opening hours', () => {
  assert.equal(isPickupTimeWithinHours({ '4': { open: '22:00', close: '02:00' }, '5': null }, '2026-10-08T14:00:00Z'), true);
});
test('invalid scheduled dates are rejected safely', () => {
  assert.equal(isPickupTimeWithinHours({}, 'invalid'), false);
});
test('winter pickup slots use Melbourne standard time', () => {
  const days = getPickupTimeSlots({ '4': { open: '10:00', close: '21:00' } }, new Date('2026-07-08T14:00:00Z'), { numDays: 1 });
  assert.equal(days[0].slots[0].value, '2026-07-09T00:00:00.000Z');
});
test('daylight-saving jump does not offer slots at or after closing', () => {
  const days = getPickupTimeSlots({ '0': { open: '01:00', close: '03:00' } }, new Date('2026-10-03T14:00:00Z'), { numDays: 1 });
  assert.ok(days[0].slots.length > 0);
  assert.ok(days[0].slots.every((slot: { value: string }) => isPickupTimeWithinHours({ '0': { open: '01:00', close: '03:00' } }, slot.value)));
  assert.equal(days[0].slots.at(-1)?.label, '01:45');
});
