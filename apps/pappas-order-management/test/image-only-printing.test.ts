import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

test('receipt printing only exposes the image transport', () => {
  const escposPrinterSource = source('lib/escpos-printer.ts');

  assert.match(escposPrinterSource, /export async function escposPrintOrderImage/);
  assert.doesNotMatch(escposPrinterSource, /escposPrintKitchenReceipt/);
  assert.doesNotMatch(escposPrinterSource, /buildRawKitchenReceiptBytes/);
});

test('order actions contain no system or text receipt fallbacks', () => {
  const orderActionsSource = source('hooks/useOrderActions.ts');
  const detailScreenSource = source('app/order-detail.tsx');

  assert.doesNotMatch(orderActionsSource, /Print\.printAsync|generatePrintHTML|escposPrintKitchenReceipt/);
  assert.doesNotMatch(detailScreenSource, /Print\.printAsync|generatePrintHTML|escposPrintKitchenReceipt/);
});

test('All Orders passes its available SmartPay action through to order details', () => {
  const historySource = source('app/(drawer)/(tabs)/orders.tsx');

  assert.match(historySource, /handleSmartpayPayment,/);
  assert.match(historySource, /onSmartpayPayment=\{handleSmartpayPayment\}/);
  assert.match(historySource, /smartpayPaired=\{smartpayPaired\}/);
  assert.match(historySource, /smartpayProcessing=\{smartpayProcessingOrderId === selectedOrder\?\.id\}/);
});

test('kitchen receipt capture mounts its template before checking its ref', () => {
  const modalSource = source('components/OrderDetailModal.tsx');

  assert.doesNotMatch(modalSource, /if \(onPrintImage && receiptRef\.current\)/);
  assert.match(modalSource, /setCaptureTarget\('kitchen'\);[\s\S]*if \(!receiptRef\.current\)/);
});

test('print simulator supports generic copy while preserving the order fallback', () => {
  const simulatorSource = source('components/PrintSimulatorModal.tsx');

  assert.match(simulatorSource, /title\?: string/);
  assert.match(simulatorSource, /subtitle\?: string/);
  assert.match(simulatorSource, /title \|\| 'Print Simulation'/);
  assert.match(simulatorSource, /subtitle \|\| `Order #\$\{/);
});

test('report printing uses the existing image pipeline at 80mm', () => {
  const reportSource = source('app/(drawer)/report.tsx');

  assert.match(reportSource, /ReportPrintTemplate/);
  assert.match(reportSource, /captureReceiptForPrinter/);
  assert.match(reportSource, /escposPrintOrderImage/);
  assert.match(reportSource, /REPORT_RECEIPT_WIDTH/);
  assert.match(reportSource, /isSimulatorPrinter/);
  assert.doesNotMatch(reportSource, /Print\.printAsync|generatePrintHTML/);
});
