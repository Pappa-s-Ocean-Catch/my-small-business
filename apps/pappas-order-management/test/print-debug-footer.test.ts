import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKitchenPrintDebugContext,
  createPrintDebugSessionId,
  getKitchenPrintDebugFooterLines,
} from '../lib/print-debug-footer';

const job = {
  registerName: 'Counter 2',
  deviceId: 'pos-device-abcdef123456',
  sessionId: 'session-123',
  trigger: 'reprint' as const,
  routeLabel: 'Kitchen -> Pass',
  sectionName: 'Kitchen',
  printerName: 'Epson Pass',
  printerTarget: 'TCP:10.0.0.12',
  printMode: 'separate' as const,
  copies: 2,
  autoPrintEnabled: false,
  autoPrintDelaySeconds: 7,
  paperWidth: '58mm' as const,
  highQuality: false,
  capturedAt: '2026-08-02T04:05:06.000Z',
};

test('kitchen print debug footer is absent when the setting is disabled', () => {
  const context = buildKitchenPrintDebugContext({ enabled: false, ...job });

  assert.deepEqual(getKitchenPrintDebugFooterLines(context), []);
});

test('kitchen print debug footer reports the immutable effective print job', () => {
  const context = buildKitchenPrintDebugContext({ enabled: true, ...job });

  assert.equal(Object.isFrozen(context), true);
  assert.deepEqual(getKitchenPrintDebugFooterLines(context), [
    'PRINT DEBUG • REPRINT • 2026-08-02T04:05:06.000Z',
    'POS Counter 2 • device ef123456 • session session-123',
    'Route Kitchen -> Pass • section Kitchen',
    'Printer Epson Pass • TCP:10.0.0.12',
    'Mode separate • copies 2',
    'Auto off • delay 7s • 58mm • high quality off',
  ]);
});

test('print debug sessions are compact and unique to their workflow inputs', () => {
  assert.equal(createPrintDebugSessionId(1_722_484_800_000, 0.123456789), 'lzaqz5s0-4fzzzx');
});
