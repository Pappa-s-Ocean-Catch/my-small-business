import test from 'node:test';
import assert from 'node:assert/strict';
import { getMarketplaceImportDiscountAmount } from '../lib/marketplace-order-summary';

test('getMarketplaceImportDiscountAmount returns order-level discount when item totals match subtotal before discount', () => {
  const discount = getMarketplaceImportDiscountAmount({
    subtotalAmount: 37.8,
    totalAmount: 28.3,
    discountAmount: 9.5,
    items: [
      { price: 'A$15.80' },
      { price: 'A$1.30' },
      { price: 'A$20.70' },
    ],
  });

  assert.equal(discount, 9.5);
});

test('getMarketplaceImportDiscountAmount skips order-level discount when item prices already reflect the discount', () => {
  const discount = getMarketplaceImportDiscountAmount({
    subtotalAmount: 31.8,
    totalAmount: 31.8,
    discountAmount: 14.7,
    items: [
      { price: 'A$10.60' },
      { price: 'A$2.40' },
      { price: 'A$18.80' },
    ],
  });

  assert.equal(discount, 0);
});
