import { describe, expect, it } from 'vitest';
import { createCatalogStore } from './catalog-store';

const sourceWithProduct = (id: string) => ({
  categories: [{ id: 'main', name: 'Main', active: true, sortOrder: 1 }],
  products: [{ id, name: id, active: true, categoryId: 'main', subCategoryId: null, sortOrder: 1 }],
  productsById: new Map(),
  productsByCategoryId: new Map(),
  customizations: new Map(),
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => { resolve = nextResolve; reject = nextReject; });
  return { promise, resolve, reject };
}

describe('catalog store', () => {
  it('does not publish a catalogue response after logout', async () => {
    const pending = deferred<ReturnType<typeof sourceWithProduct>>();
    const store = createCatalogStore({ load: () => pending.promise });
    const request = store.refresh('startup');
    store.reset();
    pending.resolve(sourceWithProduct('burger'));
    await request;
    expect(store.getState().snapshot).toBeNull();
  });

  it('retains a complete snapshot when manual refresh fails', async () => {
    let attempts = 0;
    const store = createCatalogStore({ load: async () => {
      attempts += 1;
      if (attempts === 1) return sourceWithProduct('burger');
      throw new Error('offline');
    } });
    await store.refresh('startup');
    await expect(store.refresh('manual')).rejects.toThrow('offline');
    expect(store.getState().snapshot?.products[0].id).toBe('burger');
    expect(store.getState().status).toBe('ready');
  });
});
