import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPosCatalogSnapshot, getProductCombineSections, productsForCategories } from '../lib/pos-catalog-snapshot';

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

test('getProductCombineSections extracts sections from product includes', () => {
  const snapshot = buildPosCatalogSnapshot({
    categories: [
      { id: 'cat-packs', name: 'PACKS', sort_order: 1, is_active: true, parent_category_id: null },
      { id: 'cat-fried', name: 'Fried Food', sort_order: 2, is_active: true, parent_category_id: null, section: 'Fried' },
    ],
    products: [
      { id: 'flake-pack', name: 'Flake Pack For One', description: null, search_term: null, section: null, sale_price: 18, image_url: null, sale_category_id: 'cat-packs', sub_category_id: null, sort_order: 1, is_active: true },
      { id: 'chips', name: 'Small Chips', description: null, search_term: null, section: 'Fried', sale_price: 5, image_url: null, sale_category_id: 'cat-fried', sub_category_id: null, sort_order: 2, is_active: true },
      { id: 'dim-sim', name: 'Dim Sim', description: null, search_term: null, section: null, sale_price: 2, image_url: null, sale_category_id: 'cat-fried', sub_category_id: null, sort_order: 3, is_active: true },
      { id: 'single-fish', name: 'Flake (I)', description: null, search_term: null, section: 'Fried', sale_price: 10, image_url: null, sale_category_id: 'cat-fried', sub_category_id: null, sort_order: 4, is_active: true },
    ],
    addonLinks: [],
    ingredients: [],
    productIncludes: [
      { parent_sale_product_id: 'flake-pack', included_sale_product_id: 'chips' },
      { parent_sale_product_id: 'flake-pack', included_sale_product_id: 'dim-sim' },
    ],
    promotions: [], layouts: [], selectedLayoutId: null,
  });

  const flakePack = snapshot.productsById.get('flake-pack')!;
  const singleFish = snapshot.productsById.get('single-fish')!;

  assert.deepEqual(getProductCombineSections(snapshot, flakePack), ['Fried']);
  assert.deepEqual(getProductCombineSections(snapshot, singleFish), []);
});

test('getProductCombineSections falls back to Fried if name indicates a combine/pack product without includes', () => {
  const snapshot = buildPosCatalogSnapshot({
    categories: [
      { id: 'cat-packs', name: 'Packs', sort_order: 1, is_active: true, parent_category_id: null },
    ],
    products: [
      { id: 'family-pack', name: 'Family Pack', description: null, search_term: null, section: null, sale_price: 45, image_url: null, sale_category_id: 'cat-packs', sub_category_id: null, sort_order: 1, is_active: true },
    ],
    addonLinks: [],
    ingredients: [],
    productIncludes: [],
    promotions: [], layouts: [], selectedLayoutId: null,
  });

  const familyPack = snapshot.productsById.get('family-pack')!;
  assert.deepEqual(getProductCombineSections(snapshot, familyPack), ['Fried']);
});

