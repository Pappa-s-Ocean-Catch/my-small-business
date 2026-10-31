import test from 'node:test';
import assert from 'node:assert/strict';
import { productGroupId } from '../components/pos/pos-navigation';
import type { SaleCategory, SaleProduct } from '../app/pos.types';
import type { PosLayoutData } from '../lib/pos-layout-config';
const categories = [{ id: 'sides', name: 'Sides' }, { id: 'hot', parent_category_id: 'sides', name: 'Hot' }] as SaleCategory[];
const product = { id: 'cake', sale_category_id: 'sides', sub_category_id: 'hot' } as SaleProduct;
const layout: PosLayoutData = { version: 1, categories: [{ categoryId: 'favourites', sourceCategoryIds: ['sides'], products: [{ productId: 'cake' }] }, { categoryId: 'other', products: [] }] };
test('modifier return preserves the originating virtual group', () => {
  assert.equal(productGroupId(product, categories, layout, 'favourites'), 'favourites');
});
test('search, quick list and cart origins return to the product group rather than an unrelated current group', () => {
  assert.equal(productGroupId(product, categories, layout, 'other'), 'favourites');
  assert.equal(productGroupId(product, categories, null, 'other'), 'sides');
  assert.equal(productGroupId(product, categories, null), 'sides');
});
test('search and cart return to visible virtual group when its source is hidden', () => {
  const virtual: PosLayoutData = { version: 1, categories: [{ categoryId: 'sides', products: [] }, { categoryId: 'favourites', sourceCategoryIds: ['sides'], hideSourceCategories: true, products: [] }] };
  assert.equal(productGroupId(product, categories, virtual, 'sides'), 'favourites');
});

import { categoryMenuContext, productMenuContext } from '../components/pos/pos-navigation';
const drinks = [{ id: 'drinks', name: 'Drinks' }, { id: 'cans', name: 'Cans', parent_category_id: 'drinks' }, { id: 'bottles', name: 'Bottles', parent_category_id: 'drinks' }] as SaleCategory[];
const coke = { id: 'coke', sale_category_id: 'drinks', sub_category_id: 'cans' } as SaleProduct;
test('Drinks opens subcategories before their products', () => {
  assert.deepEqual(categoryMenuContext('drinks', drinks, null), { level: 'subgroups', categoryId: null, parentCategoryId: 'drinks' });
  assert.deepEqual(categoryMenuContext('sides', categories, { version: 1, categories: [{ categoryId: 'sides', showProductsOnTopLevel: true, products: [] }] }), { level: 'items', categoryId: 'sides', parentCategoryId: null });
});
test('Continue, cart and search return a drink to its own subcategory', () => {
  assert.deepEqual(productMenuContext(coke, drinks, null), { level: 'items', categoryId: 'cans', parentCategoryId: 'drinks' });
  assert.deepEqual(productMenuContext(coke, drinks, null, 'drinks'), { level: 'items', categoryId: 'cans', parentCategoryId: 'drinks' });
});
test('explicit flattened and virtual POS groups retain their configured navigation', () => {
  const flat: PosLayoutData = { version: 1, categories: [{ categoryId: 'drinks', showProductsOnTopLevel: true, products: [] }] };
  assert.deepEqual(productMenuContext(coke, drinks, flat, 'drinks'), { level: 'items', categoryId: 'drinks', parentCategoryId: null });
  const virtual: PosLayoutData = { version: 1, categories: [{ categoryId: 'bar', sourceCategoryIds: ['drinks'], hideSourceCategories: true, products: [] }] };
  assert.deepEqual(categoryMenuContext('bar', drinks, virtual), { level: 'subgroups', categoryId: null, parentCategoryId: 'bar' });
  assert.deepEqual(productMenuContext(coke, drinks, virtual), { level: 'items', categoryId: 'cans', parentCategoryId: 'bar' });
});

import { productTapSkipsCustomization } from '../components/pos/pos-navigation';
test('Sides and Seafood Sides direct-add preferences follow the product group', () => {
  const groups = [{ id: 'sides', name: 'Sides' }, { id: 'seafood', name: 'Seafood Sides' }, { id: 'fish', name: 'Fish' }] as SaleCategory[];
  const preferences: PosLayoutData = { version: 1, categories: [
    { categoryId: 'sides', showProductsOnTopLevel: true, products: [] },
    { categoryId: 'seafood', showProductsOnTopLevel: true, products: [] },
    { categoryId: 'fish', showProductsOnTopLevel: false, products: [] },
  ] };
  for (const categoryId of ['sides', 'seafood']) {
    const item = { id: `item-${categoryId}`, sale_category_id: categoryId } as SaleProduct;
    assert.equal(productTapSkipsCustomization(item, groups, preferences, categoryId), true);
    assert.equal(productTapSkipsCustomization(item, groups, preferences, 'fish'), true, 'Search/Quick list must use the product group, not an unrelated selected group');
  }
  assert.equal(productTapSkipsCustomization({ id: 'flake', sale_category_id: 'fish' } as SaleProduct, groups, preferences, 'fish'), false);
  assert.equal(productTapSkipsCustomization(product, categories, null, 'sides'), false);
});
test('direct-add preference follows the visible virtual group and preserves ordinary Drinks navigation', () => {
  const preferences: PosLayoutData = { version: 1, categories: [
    { categoryId: 'sides', products: [] },
    { categoryId: 'favourites', sourceCategoryIds: ['sides'], hideSourceCategories: true, showProductsOnTopLevel: true, products: [] },
  ] };
  assert.equal(productTapSkipsCustomization(product, categories, preferences, 'sides'), true);
  assert.equal(productTapSkipsCustomization(coke, drinks, null, 'drinks'), false);
});
