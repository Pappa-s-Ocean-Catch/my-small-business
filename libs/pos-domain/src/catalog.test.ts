import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogSnapshot, productsForCategories } from './catalog.js';

test('builds category indexes from an injected catalogue source', () => {
  const snapshot = buildCatalogSnapshot({
    categories: [{ id: 'main', name: 'Main', sortOrder: 1, active: true }],
    products: [{ id: 'burger', name: 'Burger', categoryId: 'main', subCategoryId: null, sortOrder: 1, active: true }],
  });

  assert.deepEqual(productsForCategories(snapshot, ['main']).map((product) => product.id), ['burger']);
});

test('excludes inactive products from every category index', () => {
  const snapshot = buildCatalogSnapshot({
    categories: [{ id: 'main', name: 'Main', sortOrder: 1, active: true }],
    products: [
      { id: 'burger', name: 'Burger', categoryId: 'main', subCategoryId: null, sortOrder: 1, active: true },
      { id: 'old-burger', name: 'Old burger', categoryId: 'main', subCategoryId: null, sortOrder: 2, active: false },
    ],
  });

  assert.deepEqual(productsForCategories(snapshot, ['main']).map((product) => product.id), ['burger']);
});
