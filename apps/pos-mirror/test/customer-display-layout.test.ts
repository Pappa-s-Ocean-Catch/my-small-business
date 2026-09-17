import assert from 'node:assert/strict';
import test from 'node:test';

import { getCustomerDisplayLayout } from '../src/lib/customer-display-layout';

test('keeps price information dense and readable on a compact landscape display', () => {
  assert.deepEqual(getCustomerDisplayLayout({ width: 640, height: 360 }), {
    compact: true,
    gutter: 16,
    rowMinHeight: 64,
    totalPanelWidth: 230,
    totalFontSize: 40,
  });
});

test('uses the extra space on a larger customer display for the totals panel', () => {
  assert.deepEqual(getCustomerDisplayLayout({ width: 1280, height: 800 }), {
    compact: false,
    gutter: 32,
    rowMinHeight: 88,
    totalPanelWidth: 360,
    totalFontSize: 56,
  });
});
