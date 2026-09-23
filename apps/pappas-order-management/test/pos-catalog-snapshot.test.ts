import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPosCatalogSnapshot, productsForCategories } from '../lib/pos-catalog-snapshot';

test('catalogue snapshot indexes every product customization without a later fetch', () => {
  const snapshot = buildPosCatalogSnapshot({
    categories: [{ id: 'food', name: 'Food', sort_order: 1, is_active: true, parent_category_id: null }],
    products: [{ id: 'burger', name: 'Burger', description: null, search_term: null, section: null, sale_price: 12, image_url: null, sale_category_id: 'food', sub_category_id: null, sort_order: 1, is_active: true }],
    addonLinks: [{ sale_product_id: 'burger', display_order: 1, addon_groups: { id: 'extras', name: 'Extras', is_required: false, multiple_choice: true, addon_items: [{ id: 'cheese', addon_group_id: 'extras', name: 'Cheese', extra_price: 1, sort_order: 1, is_active: true }] } }],
    ingredients: [{ id: 'ingredient-1', sale_product_id: 'burger', customer_can_remove: true, products: { name: 'Onion' } }],
    promotions: [], layouts: [], selectedLayoutId: null,
  });
  assert.deepEqual(productsForCategories(snapshot, ['food']).map((product) => product.id), ['burger']);
  assert.equal(snapshot.customizations.get('burger')?.groups[0].items[0].id, 'cheese');
  assert.equal(snapshot.customizations.get('burger')?.removableIngredients[0].ingredient_name, 'Onion');
  assert.equal(snapshot.customizableIds.has('burger'), true);
});
