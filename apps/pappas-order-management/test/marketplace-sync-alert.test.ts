import assert from 'node:assert/strict';
import test from 'node:test';

import { marketplaceSyncAlertStore } from '../stores/marketplaceSyncAlertStore';

test('shows a provider sync failure until it is dismissed', () => {
  marketplaceSyncAlertStore.getState().clear('uber_eats');
  marketplaceSyncAlertStore.getState().reportFailure('uber_eats');

  assert.equal(marketplaceSyncAlertStore.getState().alerts.uber_eats?.visible, true);

  marketplaceSyncAlertStore.getState().dismiss('uber_eats');
  assert.equal(marketplaceSyncAlertStore.getState().alerts.uber_eats?.visible, false);
});

test('a successful poll clears a dismissed marketplace failure', () => {
  marketplaceSyncAlertStore.getState().reportFailure('doordash');
  marketplaceSyncAlertStore.getState().dismiss('doordash');
  marketplaceSyncAlertStore.getState().clear('doordash');

  assert.equal(marketplaceSyncAlertStore.getState().alerts.doordash, undefined);
});

test('a later marketplace failure is visible after a dismissal', () => {
  marketplaceSyncAlertStore.getState().reportFailure('uber_eats');
  marketplaceSyncAlertStore.getState().dismiss('uber_eats');
  marketplaceSyncAlertStore.getState().reportFailure('uber_eats');

  assert.equal(marketplaceSyncAlertStore.getState().alerts.uber_eats?.visible, true);
});
