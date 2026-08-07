import assert from 'node:assert/strict';
import test from 'node:test';
import { createPosCatalogCacheStore } from '../stores/posCatalogCacheStore';

test('removes expired catalog entries when they are read', () => {
  let now = 1_000;
  const cache = createPosCatalogCacheStore({ now: () => now });

  cache.getState().setCategories([{ id: 'category-1' } as any], 10);
  assert.equal(cache.getState().getCategories()?.[0].id, 'category-1');

  now = 1_010;
  assert.equal(cache.getState().getCategories(), null);
});

test('evicts the oldest category result when its bounded cache is full', () => {
  const cache = createPosCatalogCacheStore({ categoryLimit: 2 });

  cache.getState().setProductsByCategory('a', []);
  cache.getState().setProductsByCategory('b', []);
  cache.getState().setProductsByCategory('c', []);

  assert.equal(cache.getState().getProductsByCategory('a'), null);
  assert.deepEqual(cache.getState().getProductsByCategory('c'), []);
});

test('clears every transient POS catalog cache entry', () => {
  const cache = createPosCatalogCacheStore();

  cache.getState().setCategories([{ id: 'category-1' } as any]);
  cache.getState().setAllProducts([{ id: 'product-1' } as any]);
  cache.getState().setCustomizationAvailability('product-1', true);
  cache.getState().setCustomization('product-1', { groups: [], removableIngredients: [] });
  cache.getState().setTopSellers([{ id: 'product-1' } as any]);
  cache.getState().clear();

  assert.equal(cache.getState().getCategories(), null);
  assert.equal(cache.getState().getAllProducts(), null);
  assert.equal(cache.getState().getCustomizationAvailability('product-1'), null);
  assert.equal(cache.getState().getCustomization('product-1'), null);
  assert.equal(cache.getState().getTopSellers(), null);
});
