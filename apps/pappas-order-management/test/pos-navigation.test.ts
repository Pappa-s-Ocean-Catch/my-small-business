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
