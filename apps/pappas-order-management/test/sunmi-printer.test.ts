import assert from 'node:assert/strict';
import test from 'node:test';
import { getPrinterDriver, createSunmiSavedPrinter } from '../lib/printer-types';
import { createSettingsBackup, parseSettingsBackup } from '../lib/settings-backup';

test('Sunmi has one local target and survives settings backup', () => {
  const printer = createSunmiSavedPrinter();
  assert.equal(printer.target, 'SUNMI:BUILTIN');
  assert.equal(getPrinterDriver(printer), 'sunmi');
  assert.equal(printer.ipAddress, undefined);
  assert.deepEqual(parseSettingsBackup(JSON.stringify(createSettingsBackup({ printerSaved: [printer] }))).printerSaved, [printer]);
});
test('existing driver selection remains compatible', () => {
  const base = { target: 'TCP:192.168.1.2', deviceName: 'Kitchen' };
  assert.equal(getPrinterDriver(base), 'epsonSdk');
  assert.equal(getPrinterDriver({ ...base, driver: 'rawTcp' }), 'rawTcp');
  assert.equal(getPrinterDriver({ ...base, driver: 'simulator' }), 'simulator');
  assert.equal(getPrinterDriver({ ...base, target: 'SIMULATOR:Test' }), 'simulator');
  assert.equal(getPrinterDriver(null), 'epsonSdk');
});

test('Sunmi dispatch serializes jobs and recovers after failure without network drivers', async () => {
  const Module = require('node:module') as any;
  const originalLoad = Module._load;
  const calls: string[] = [];
  let fail = true;
  Module._load = function (id: string, ...args: unknown[]) {
    if (id === 'react-native') return { Platform: { OS: 'android' } };
    if (id === 'expo-modules-core') return { requireNativeModule: (name: string) => {
      assert.equal(name, 'SunmiPrinter');
      return {
        printRaw: async (bytes: number[]) => {
          assert.ok(bytes.length > 0);
          calls.push('raw');
          if (fail) { fail = false; throw new Error('paper out'); }
        },
        printImage: async (uri: string, width: number, copies: number) => {
          assert.deepEqual([uri, width, copies], ['file:///receipt.png', 576, 2]);
          calls.push('image');
        },
      };
    } };
    if (id === 'react-native-esc-pos-printer' || id === 'react-native-tcp-socket') throw new Error('Sunmi must not load network drivers');
    return originalLoad.call(this, id, ...args);
  };
  try {
    const { escposPrintDocument, escposPrintOrderImage } = require('../lib/escpos-printer');
    const printer = createSunmiSavedPrinter();
    const document = { nodes: [{ type: 'text', text: 'Ticket' }, { type: 'cut' }] };
    const first = escposPrintDocument(document, printer);
    const second = escposPrintDocument(document, printer);
    await assert.rejects(first, /paper out/);
    await second;
    const metrics = await escposPrintOrderImage('file:///receipt.png', printer, 2, 576);
    assert.equal(metrics.driver, 'sunmi');
    assert.deepEqual(calls, ['raw', 'raw', 'image']);
  } finally { Module._load = originalLoad; }
});
