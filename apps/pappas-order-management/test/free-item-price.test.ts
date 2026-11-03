import assert from 'node:assert/strict';
import test from 'node:test';
import { computePosFreeItemPromotion } from '../lib/pos-promotions';
import { computeCartPromotionTotals as webTotals, type PromotionWithProducts } from '../../web/src/lib/promotions';
import { computeCartPromotionTotals as apiTotals } from '../../api/src/lib/promotions';
import { computeCartPromotionTotals as portalTotals } from '../../web-portal/src/lib/promotions';

const promotion: PromotionWithProducts = {
  id: 'free-drink', title: 'Free drink', description: null, is_active: true,
  applies_to: 'cart', discount_type: 'fixed', discount_value: 5,
  starts_at: null, ends_at: null, days_of_week: null,
  daily_start_minute: null, daily_end_minute: null,
  product_scope: 'specific', min_product_price: null,
  cart_scope: 'subtotal_min', min_cart_subtotal: 70, priority: 0,
  product_ids: ['drink', 'other-drink'], show_on_home: true, home_title: null,
  created_at: '', updated_at: '',
};

const implementations = {
  web: webTotals,
  api: apiTotals,
  portal: portalTotals,
  pos: (params: Parameters<typeof webTotals>[0]) => {
    const result = computePosFreeItemPromotion({
      ...params,
      items: params.items.map((item) => ({ ...item, product_name: item.name ?? '' })),
    });
    return {
      cartDiscount: result.discountAmount,
      subtotalAfterPromotions: params.cartSubtotal - result.discountAmount,
      applied: result.appliedPromotion ? [result.appliedPromotion] : [],
    };
  },
};

for (const [channel, computeTotals] of Object.entries(implementations)) {
  for (const threshold of [70, 120]) {
    for (const [price, quantity] of [[5.5, 1], [6.75, 2], [4.25, 1]]) {
      test(`${channel}: $${threshold} gift discounts one $${price} unit with quantity ${quantity}`, () => {
        const totals = computeTotals({
          promotions: [{ ...promotion, min_cart_subtotal: threshold }],
          items: [
            { id: 'meal', product_id: 'meal', base_price: threshold, quantity: 1, subtotal: threshold },
            { id: 'gift', product_id: 'drink', name: 'Cola', base_price: price, quantity, subtotal: price * quantity },
          ],
          cartSubtotal: threshold + price * quantity,
          selectedFreeItemId: 'gift',
        });
        assert.equal(totals.cartDiscount, price);
        assert.equal(totals.subtotalAfterPromotions, threshold + price * (quantity - 1));
        assert.equal(totals.applied[0]?.amount, price);
        assert.equal(totals.applied[0]?.kind, 'free_item');
      });
    }
  }

  test(`${channel}: switching gifts recalculates the discount from the selected row`, () => {
    const params = {
      promotions: [promotion],
      items: [
        { id: 'meal', product_id: 'meal', base_price: 70, quantity: 1, subtotal: 70 },
        { id: 'cola', product_id: 'drink', base_price: 5.5, quantity: 1, subtotal: 5.5 },
        { id: 'juice', product_id: 'other-drink', base_price: 6.75, quantity: 1, subtotal: 6.75 },
      ],
      cartSubtotal: 82.25,
    };
    assert.equal(computeTotals({ ...params, selectedFreeItemId: 'cola' }).cartDiscount, 5.5);
    assert.equal(computeTotals({ ...params, selectedFreeItemId: 'juice' }).cartDiscount, 6.75);
  });

  test(`${channel}: the gift price cannot qualify an otherwise below-threshold cart`, () => {
    const totals = computeTotals({
      promotions: [promotion],
      items: [
        { id: 'meal', product_id: 'meal', base_price: 69.99, quantity: 1, subtotal: 69.99 },
        { id: 'gift', product_id: 'drink', base_price: 5.5, quantity: 1, subtotal: 5.5 },
      ],
      cartSubtotal: 75.49,
      selectedFreeItemId: 'gift',
    });
    assert.equal(totals.cartDiscount, 0);
    assert.equal(totals.applied.length, 0);
  });
}

for (const [channel, computeTotals] of Object.entries({ web: webTotals, api: apiTotals, portal: portalTotals })) {
  test(`${channel}: ordinary fixed discounts still use their configured value`, () => {
    const totals = computeTotals({
      promotions: [{ ...promotion, product_ids: [] }],
      items: [{ id: 'meal', product_id: 'meal', base_price: 70, quantity: 1, subtotal: 70 }],
      cartSubtotal: 70,
    });
    assert.equal(totals.cartDiscount, 5);
    assert.equal(totals.subtotalAfterPromotions, 65);
  });
}
