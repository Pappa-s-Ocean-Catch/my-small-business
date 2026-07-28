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
