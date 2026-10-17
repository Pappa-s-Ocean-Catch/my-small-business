import assert from 'node:assert/strict';
import test from 'node:test';
import { computePosFreeItemPromotion, restorePosOrderPromotions, type PosPromotion } from '../lib/pos-promotions';

const promotion: PosPromotion = {
  id: 'promo', title: 'Free drink', description: null, is_active: true,
  applies_to: 'cart', discount_type: 'fixed', discount_value: 0,
  starts_at: null, ends_at: null, days_of_week: null,
  daily_start_minute: null, daily_end_minute: null,
  product_scope: 'specific', min_product_price: null,
  cart_scope: 'subtotal_min', min_cart_subtotal: 50, priority: 0,
  product_ids: ['drink'],
};
const items = [
  { id: 'meal-row', product_id: 'meal', product_name: 'Meal', base_price: 50, quantity: 1, subtotal: 50 },
  { id: 'paid-drink-row', product_id: 'drink', product_name: 'Cola', base_price: 5, quantity: 1, subtotal: 5 },
  { id: 'free-drink-row', product_id: 'drink', product_name: 'FREE Cola on orders over $50', base_price: 5, quantity: 1, subtotal: 5 },
];
const applied = {
  id: 'promo', title: 'Free drink', applies_to: 'cart', kind: 'free_item', amount: 5,
  selected_item_id: 'online-cart-id', selected_item_name: 'FREE Cola on orders over $50', threshold: 50,
};

test('editing an online order restores its existing free item without requesting another', () => {
  const restored = restorePosOrderPromotions({ promotion_discount: 5, promotions_applied: [applied] }, items);
  assert.equal(restored.selectedFreeItemId, 'free-drink-row');
  assert.equal(restored.items.length, 3);
  assert.equal(restored.items[1].product_name, 'Cola');
  assert.equal(restored.items[2].product_name, 'Cola');
  assert.equal(restored.promotionDiscount, 0);
  const totals = computePosFreeItemPromotion({
    promotions: [promotion], items: restored.items, cartSubtotal: 60,
    selectedFreeItemId: restored.selectedFreeItemId,
  });
  assert.equal(totals.freeItemSelectionRequired, false);
  assert.equal(totals.discountAmount, 5);
  assert.equal(totals.appliedPromotion?.selected_item_name, 'FREE Cola on orders over $50');
});

test('reopening an edited order resolves the free item after database IDs change again', () => {
  const restored = restorePosOrderPromotions({ promotion_discount: 8, promotions_applied: [
    { source: 'pos', kind: 'fixed', value: 3, amount: 3 }, applied,
  ] }, items);
  assert.equal(restored.selectedFreeItemId, 'free-drink-row');
  assert.equal(restored.promotionDiscount, 3);
  assert.deepEqual(restored.promotionsApplied, [{ source: 'pos', kind: 'fixed', value: 3, amount: 3 }]);
});

test('restored free item loses eligibility when paid items fall below the threshold', () => {
  const restored = restorePosOrderPromotions({ promotion_discount: 5, promotions_applied: [applied] }, items);
  const totals = computePosFreeItemPromotion({
    promotions: [promotion], items: restored.items.filter((item) => item.id !== 'meal-row'),
    cartSubtotal: 10, selectedFreeItemId: restored.selectedFreeItemId,
  });
  assert.equal(totals.freeItemPromotion, null);
  assert.equal(totals.discountAmount, 0);
  assert.equal(restored.promotionDiscount, 0);
});

test('does not turn an ordinary paid drink into a free item when the saved free row is missing', () => {
  const restored = restorePosOrderPromotions({ promotion_discount: 5, promotions_applied: [applied] }, items.slice(0, 2));
  assert.equal(restored.selectedFreeItemId, null);
  assert.equal(restored.promotionDiscount, 0);
});

test('restores a selection by persisted item ID and leaves ordinary discounts untouched', () => {
  const restored = restorePosOrderPromotions({ promotion_discount: 5, promotions_applied: [
    { ...applied, selected_item_id: 'free-drink-row' },
  ] }, items);
  assert.equal(restored.selectedFreeItemId, 'free-drink-row');
  const ordinary = restorePosOrderPromotions({ promotion_discount: 3, promotions_applied: [
    { kind: 'fixed', amount: 3 },
  ] }, items.slice(0, 2));
  assert.equal(ordinary.selectedFreeItemId, null);
  assert.equal(ordinary.promotionDiscount, 3);
  assert.deepEqual(ordinary.items, items.slice(0, 2));
});
