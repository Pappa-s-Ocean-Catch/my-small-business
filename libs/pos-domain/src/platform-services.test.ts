import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnsupportedPlatformServices } from './platform-services.js';

test('unsupported platform services fail POS capabilities safely', async () => {
  const services = createUnsupportedPlatformServices();

  assert.deepEqual(await services.printer.print(), {
    ok: false,
    code: 'UNSUPPORTED_PLATFORM',
    message: 'Printing is not available on this platform.',
  });
  assert.deepEqual(await services.notifications.notify({ title: 'Order saved', body: 'ORD-001' }), {
    ok: false,
    code: 'UNSUPPORTED_PLATFORM',
    message: 'Notifications are not available on this platform.',
  });
  assert.equal(services.callerId.supported, false);
});
