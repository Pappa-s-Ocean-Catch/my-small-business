import assert from 'node:assert/strict';
import test from 'node:test';
import { addressKey, canSubmitDelivery, selectedQuote, needsDeliveryRecovery, deliveryRequestMessage, dateRangeBounds } from '../lib/delivery-management-state';
import type { DeliveryRequest, DeliveryJobAddress } from '../../../libs/types/delivery-management';

const address: DeliveryJobAddress = { address_line1: '12 Main Street', city: 'Melton', state: 'VIC', postcode: '3337', country: 'AU' };
const request: DeliveryRequest = { id: 'q1', reference: 'DOD-1', state: 'quoted', shipdayOrderId: null, orderId: null, quotes: [{ id: 'a', provider: 'Courier A', fee: 12, currency: 'AUD', pickupAt: null, deliveryAt: null, pickupMinutes: 5, deliveryMinutes: 20 }, { id: 'b', provider: 'Courier B', fee: 14, currency: 'AUD', pickupAt: null, deliveryAt: null, pickupMinutes: 8, deliveryMinutes: 25 }], expiresAt: '2099-01-01T00:00:00Z', error: null, trackingUrl: null };

test('address details, coordinates and instructions invalidate quotes', () => {
  for (const change of [{ address_line1: '13 Main Street' }, { address_line2: 'Unit 2' }, { delivery_instructions: 'Side door' }, { latitude: -37 }]) {
    assert.notEqual(addressKey(address), addressKey({ ...address, ...change }));
  }
  assert.equal(addressKey(address), addressKey({ ...address }));
});
test('only a current explicitly selected provider quote can be submitted', () => {
  assert.equal(selectedQuote(request, null), null);
  assert.equal(selectedQuote(request, 1)?.provider, 'Courier B');
  assert.equal(selectedQuote(request, 4), null);
  assert.equal(canSubmitDelivery(request, 1, false), true);
  assert.equal(canSubmitDelivery(request, null, false), false);
  assert.equal(canSubmitDelivery(request, 1, true), false);
  assert.equal(canSubmitDelivery({ ...request, expiresAt: '2000-01-01T00:00:00Z' }, 1, false), false);
  assert.equal(canSubmitDelivery({ ...request, state: 'needs_confirmation' }, 0, false), true);
});
test('in-flight and uncertain requests require read recovery and cannot be resubmitted', () => {
  for (const state of ['creating', 'created', 'assigning', 'creation_uncertain', 'assignment_uncertain'] as const) {
    assert.equal(needsDeliveryRecovery(state), true);
    assert.equal(canSubmitDelivery({ ...request, state }, 0, false), false);
  }
  assert.equal(canSubmitDelivery({ ...request, state: 'requested' }, 0, false), false);
  assert.match(deliveryRequestMessage('creation_uncertain'), /check/i);
  assert.match(deliveryRequestMessage('needs_confirmation'), /quote/i);
});
test('date bounds include the whole local end date and reject impossible dates', () => {
  const bounds = dateRangeBounds('2026-09-01', '2026-09-07');
  assert.equal(new Date(bounds.from).getDate(), 1);
  assert.equal(new Date(bounds.to).getDate(), 8);
  assert.throws(() => dateRangeBounds('2026-02-30', '2026-09-07'));
  assert.throws(() => dateRangeBounds('2026-09-08', '2026-09-07'));
});
