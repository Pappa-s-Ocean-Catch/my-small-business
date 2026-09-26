import { describe, expect, it } from 'vitest';
import { createCartStore } from './cart-store';

describe('cart store', () => {
  it('combines matching products and calculates the subtotal in cents', () => {
    const store = createCartStore();
    const burger = { productId: 'burger', name: 'Classic burger', salePriceCents: 1200, addons: [], removedIngredients: [], notes: '' };

    store.addProduct(burger);
    store.addProduct(burger);
    store.addProduct({ productId: 'chips', name: 'Chips', salePriceCents: 350, addons: [], removedIngredients: [], notes: '' });

    expect(store.getState().lines).toHaveLength(2);
    expect(store.getState().lines[0]).toMatchObject({ productId: 'burger', name: 'Classic burger', salePriceCents: 1200, quantity: 2 });
    expect(store.getState().lines[1]).toMatchObject({ productId: 'chips', name: 'Chips', salePriceCents: 350, quantity: 1 });
    expect(store.getState().subtotalCents).toBe(2750);
  });

  it('removes a line when its quantity reaches zero', () => {
    const store = createCartStore();
    store.addProduct({ productId: 'burger', name: 'Classic burger', salePriceCents: 1200, addons: [], removedIngredients: [], notes: '' });

    const lineId = store.getState().lines[0].id;
    store.setQuantity(lineId, 0);

    expect(store.getState().lines).toEqual([]);
    expect(store.getState().subtotalCents).toBe(0);
  });
});
