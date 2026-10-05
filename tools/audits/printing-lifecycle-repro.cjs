// Read-only reproductions against the application's actual TypeScript modules.
// Run from the repository root: node tools/audits/printing-lifecycle-repro.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { EventEmitter } = require('node:events');
const root = path.resolve(__dirname, '../..');
const app = path.join(root, 'apps/pappas-order-management');
const originalLoad = Module._load;
const originalNow = Date.now;
let now = originalNow();
let nativeCalls = 0;
let finishNative;
let textSocket;
const blockedNative = new Promise(resolve => { finishNative = resolve; });

require.extensions['.ts'] = (module, filename) => {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  });
  module._compile(compiled.outputText, filename);
};
Module._load = function(id, parent, isMain) {
  if (id === 'react-native') return { Platform: { OS: 'android' } };
  if (id === 'expo-modules-core') return {};
  if (id === 'react-native-tcp-socket') return { createConnection: () => {
    textSocket = new EventEmitter();
    textSocket.destroy = () => {};
    return textSocket;
  } };
  if (id === '@my-small-business/native-raw-tcp-printer') return {
    getNativeRawTcpPrinter: () => ({ print: async () => { nativeCalls++; return blockedNative; } }),
  };
  if (id.startsWith('@/')) id = path.join(app, id.slice(2));
  return originalLoad.call(this, id, parent, isMain);
};
Date.now = () => now;

async function main() {
  const { usePrinterAutomationStore: store } = require(path.join(app, 'stores/printerAutomationStore.ts'));
  const queue = require(path.join(app, 'lib/print-queue.ts'));
  const printer = { target: 'TCP:192.0.2.1', deviceName: 'Audit printer', driver: 'rawTcp', ipAddress: '192.0.2.1', port: 9100 };
  const enqueue = () => queue.enqueuePreparedPrintJobs({ source: 'auto', scope: 'audit', silentSuccess: true,
    jobs: [{ printer, width: 576, label: 'audit', image: { kind: 'native-view', nativeViewTag: 1, captureScale: 2, quality: 'high' } }],
  })[0];
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

  // Terminal store state really does remove image/document references.
  const completed = enqueue();
  store.getState().markPrintJobStarted(completed.id);
  store.getState().markPrintJobSucceeded(completed.id);
  assert.equal(store.getState().printJobs.find(j => j.id === completed.id).image, null);
  console.log('PASS: successful store jobs strip image payloads');
  store.getState().clearPrintHistory();

  // A store timeout does not settle/cancel the transport's promise tail.
  const pending = [];
  for (let i = 0; i < 5; i++) {
    const job = enqueue();
    pending.push(queue.processPendingPrintJob(job.id));
    await flush();
    now += 11 * 60 * 1000;
    store.getState().pruneRuntimeState();
    assert.equal(store.getState().printJobs.find(j => j.id === job.id).status, 'failed');
  }
  assert.equal(nativeCalls, 1);
  console.log('PASS: reproduced 5 timed-out store jobs with only 1 transport call; 4 dispatches remain behind its unresolved promise');

  finishNative({ ok: true, sent: true, totalMs: 0, captureMs: 0, resizeMs: 0, rasterMs: 0, sendMs: 0, width: 576, height: 1, byteLength: 1 });
  await Promise.all(pending);
  assert.equal(nativeCalls, 5);
  console.log('PASS: all 4 previously failed jobs still dispatch after the blocked transport is released (late-print risk)');

  // Starting a terminal job is permitted, even after its payload was removed.
  const terminal = enqueue();
  store.getState().markPrintJobSucceeded(terminal.id);
  const restarted = store.getState().markPrintJobStarted(terminal.id);
  assert.equal(restarted.status, 'printing');
  assert.equal(restarted.image, null);
  console.log('PASS: reproduced terminal job restarting without a payload');

  // Waiting only subscribes to future changes; an already-completed job is missed.
  store.getState().markPrintJobSucceeded(terminal.id);
  let resolved = false;
  const waiting = queue.waitForPrintJobs([terminal.id]).then(result => { resolved = true; return result; });
  await flush();
  assert.equal(resolved, false);
  store.getState().dismissToast(); // unrelated update wakes the subscription
  assert.equal((await waiting).success, true);
  console.log('PASS: reproduced completed-job waiter requiring an unrelated store update');

  const { escposPrintDocument } = require(path.join(app, 'lib/escpos-printer.ts'));
  let textSettled = false;
  const text = escposPrintDocument({ nodes: [{ type: 'text', text: 'audit' }] }, {
    ...printer, target: 'TCP:192.0.2.2', ipAddress: '192.0.2.2',
  }).then(() => { textSettled = true; }, () => { textSettled = true; });
  await flush();
  textSocket.emit('close');
  await flush();
  assert.equal(textSettled, false);
  console.log('PASS: reproduced raw TCP text promise remaining unresolved after close before connect');
  textSocket.emit('error', new Error('audit cleanup'));
  await text;
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  Module._load = originalLoad;
  Date.now = originalNow;
});
