import assert from 'node:assert/strict';
import test from 'node:test';

test('printing resources survive store pruning and release only at actual completion', async () => {
  const Module = require('node:module') as any;
  const path = require('node:path');
  const originalLoad = Module._load;
  const originalNow = Date.now;
  const captures: string[] = [];
  const released: string[] = [];
  let textSends = 0;
  let failImage = false;
  let finish: (value: unknown) => void = () => {};
  const blocked = new Promise(resolve => { finish = resolve; });
  let now = Date.now();
  Module._load = function(id: string, parent: unknown, isMain: boolean) {
    if (id === 'react-native') return { Platform: { OS: 'android' }, findNodeHandle: () => 7 };
    if (id === 'expo-modules-core') return {};
    if (id === 'react-native-view-shot') return {
      captureRef: async () => { const uri = `file:///capture-${captures.length}.png`; captures.push(uri); return uri; },
      releaseCapture: (uri: string) => released.push(uri),
    };
    if (id === 'react-native-tcp-socket') throw new Error('Leaking TCP dependency must not load for Android printing');
    if (id === '@my-small-business/native-raw-tcp-printer') return { getNativeRawTcpPrinter: () => ({
      print: () => failImage ? Promise.resolve({ ok: false, error: { code: 'SEND_FAILED', phase: 'send', message: 'paper out' } }) : blocked,
      printRaw: async (input: any) => { assert.ok(input.bytes.length > 0); textSends++; return { ok: true, sent: true }; },
    }) };
    if (id.startsWith('@/')) id = path.join(__dirname, '..', id.slice(2));
    return originalLoad.call(this, id, parent, isMain);
  };
  Date.now = () => now;
  try {
    const { acquireReceiptRender } = require('../lib/receipt-render-lock');
    const unlock = await acquireReceiptRender('test');
    let acquired = false;
    const next = acquireReceiptRender('test').then((release: () => void) => { acquired = true; return release; });
    await Promise.resolve();
    assert.equal(acquired, false, 'another order cannot change the shared capture view');
    unlock();
    const nextUnlock = await next;
    nextUnlock();
    const images = require('../lib/printer-image');
    const transport = require('../lib/escpos-printer');
    const queue = require('../lib/print-queue');
    const { usePrinterAutomationStore: store } = require('../stores/printerAutomationStore');
    const printer = { target: 'TCP:192.0.2.9', ipAddress: '192.0.2.9', port: 9100, deviceName: 'Kitchen', driver: 'rawTcp' };
    await transport.escposPrintDocument({ nodes: [{ type: 'text', text: 'Ticket' }] }, printer);
    assert.equal(textSends, 1);

    const firstImage = await images.captureReceiptForPrinter({}, printer, 576, true);
    const secondImage = await images.captureReceiptForPrinter({}, printer, 576, true);
    assert.equal(firstImage.kind, 'uri', 'queued receipts must own immutable snapshots');
    assert.notEqual(firstImage.uri, secondImage.uri);
    const jobs = queue.enqueuePreparedPrintJobs({ source: 'auto', scope: 'test', jobs: [
      { printer, width: 576, label: 'first', image: firstImage },
      { printer, width: 576, label: 'shared', image: firstImage },
    ] });
    const active = queue.processPendingPrintJob(jobs[0].id);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    store.getState().clearPrintHistory();
    assert.equal(store.getState().printJobs.length, 2, 'clearing history must preserve active and queued ownership');
    now += 11 * 60 * 1000;
    store.getState().pruneRuntimeState();
    assert.equal(store.getState().printJobs.find((j: any) => j.id === jobs[0].id).status, 'printing');
    assert.equal(store.getState().printJobs.find((j: any) => j.id === jobs[1].id).status, 'failed');
    assert.deepEqual(released, [secondImage.uri], 'only the abandoned capture is released');
    assert.equal(store.getState().markPrintJobStarted(jobs[0].id), null, 'same job cannot dispatch twice');
    finish({ ok: true, sent: true, totalMs: 0, captureMs: 0, resizeMs: 0, rasterMs: 0, sendMs: 0, width: 576, height: 1, byteLength: 1 });
    await active;
    assert.deepEqual(released, [secondImage.uri, firstImage.uri], 'last consumer releases snapshot exactly once');
    assert.equal(store.getState().markPrintJobStarted(jobs[0].id), null, 'terminal job cannot restart');
    const result = await queue.waitForPrintJobs([jobs[0].id]);
    assert.equal(result.success, true, 'completed jobs resolve without another store update');
    store.getState().clearPrintHistory();
    assert.equal(store.getState().printJobs.length, 0);
    failImage = true;
    const failedImage = await images.captureReceiptForPrinter({}, printer, 576, true);
    const [failed] = queue.enqueuePreparedPrintJobs({ source: 'auto', scope: 'test', jobs: [
      { printer, width: 576, label: 'failed', image: failedImage },
    ] });
    await queue.processPendingPrintJob(failed.id);
    assert.equal(store.getState().printJobs.find((j: any) => j.id === failed.id).status, 'failed');
    assert.equal(released.filter((uri) => uri === failedImage.uri).length, 1, 'failed dispatch releases its image');
    await assert.rejects(transport.escposPrintOrderImage('file:///external.png', printer, 1, 576), /paper out/);
    assert.equal(released.includes('file:///external.png'), false, 'external files are never deleted');
  } finally {
    Module._load = originalLoad;
    Date.now = originalNow;
  }
});
