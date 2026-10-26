import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('manual order-detail printing selects the text receipt engine before image capture', () => {
  const source = readFileSync(join(process.cwd(), 'components/OrderDetailModal.tsx'), 'utf8');
  const manualPrint = source.slice(source.indexOf('const handleInternalPrint'));
  assert.match(manualPrint, /printerReceiptMode === 'text'/);
  assert.match(manualPrint, /buildKitchenReceiptDocument/);
  assert.match(manualPrint, /enqueuePreparedPrintJobs/);
  assert.match(manualPrint, /waitForPrintJobs/);
  assert.doesNotMatch(manualPrint, /await escposPrintDocument/);
});

test('order-detail print control groups kitchen, customer-copy, and ticket printing into one menu', () => {
  const source = readFileSync(join(process.cwd(), 'components/OrderDetailModal.tsx'), 'utf8');

  assert.match(source, /printModes=\{\[/);
  assert.match(source, /label: 'Kitchen'/);
  assert.match(source, /label: 'Customer Copy'/);
  assert.match(source, /label: 'Ticket'/);
  assert.match(source, /onSelectPrinter: handleInstantTicketPrint/);
  assert.doesNotMatch(source, /label="Print Customer Copy"/);
});

test('manual print mode picker uses the native modal layer above order-detail modals', () => {
  const source = readFileSync(join(process.cwd(), 'components/printer/ManualPrintButton.tsx'), 'utf8');

  assert.match(source, /<Modal visible=\{open\} transparent/);
  assert.match(source, /Print order/);
  assert.match(source, /submitting\.current = true/);
  assert.match(source, /key=\{printer\.target\}/);
  assert.match(source, /onPress=\{\(\) => void submit\(printer\)\}/);
  assert.doesNotMatch(source, /\bMenu\b/);
});
