import assert from 'node:assert/strict';
import test from 'node:test';
import { createPosCatalogCacheStore } from '../stores/posCatalogCacheStore';

test('top-seller statistics may expire independently of the catalogue', () => {
  let now = 1_000;
  const cache = createPosCatalogCacheStore({ now: () => now });

  cache.getState().setTopSellers([{ id: 'seller-1' } as any], 10);
  assert.equal(cache.getState().getTopSellers()?.[0].id, 'seller-1');

  now = 1_010;
  assert.equal(cache.getState().getTopSellers(), null);
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


test('categories, products and add-ons never expire with elapsed time or pruning', () => {
  let now = 0;
  const cache = createPosCatalogCacheStore({ now: () => now });
  cache.getState().setCategories([{ id: 'sides' } as any]);
  cache.getState().setAllProducts([{ id: 'chips' } as any]);
  cache.getState().setProductsByCategory('sides', [{ id: 'chips' } as any]);
  cache.getState().setCustomizationAvailability('chips', true);
  const addons = { groups: [], removableIngredients: [] };
  cache.getState().setCustomization('chips', addons);
  now = 365 * 24 * 60 * 60 * 1000;
  cache.getState().pruneExpired();
  assert.equal(cache.getState().getCategories()?.[0].id, 'sides');
  assert.equal(cache.getState().getAllProducts()?.[0].id, 'chips');
  assert.equal(cache.getState().getProductsByCategory('sides')?.[0].id, 'chips');
  assert.equal(cache.getState().getCustomizationAvailability('chips'), true);
  assert.equal(cache.getState().getCustomization('chips'), addons);
});
