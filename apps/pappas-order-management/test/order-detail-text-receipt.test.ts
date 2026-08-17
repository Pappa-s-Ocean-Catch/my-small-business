import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('manual order-detail printing selects the text receipt engine before image capture', () => {
  const source = readFileSync(join(process.cwd(), 'components/OrderDetailModal.tsx'), 'utf8');
  const manualPrint = source.slice(source.indexOf('const handleInternalPrint'));
  assert.match(manualPrint, /printerReceiptMode === 'text'/);
  assert.match(manualPrint, /buildKitchenReceiptDocument/);
  assert.match(manualPrint, /escposPrintDocument/);
});
