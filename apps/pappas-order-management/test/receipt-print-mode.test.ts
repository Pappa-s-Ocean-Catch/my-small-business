import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePrinterReceiptMode } from '../lib/receipt-print-mode';

test('normalizes kitchen receipt mode to text unless image is explicitly selected', () => {
  assert.equal(normalizePrinterReceiptMode(undefined), 'text');
  assert.equal(normalizePrinterReceiptMode(null), 'text');
  assert.equal(normalizePrinterReceiptMode('text'), 'text');
  assert.equal(normalizePrinterReceiptMode('image'), 'image');
  assert.equal(normalizePrinterReceiptMode('other'), 'text');
});
