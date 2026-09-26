import { describe, expect, it, vi } from 'vitest';
import type { CartLine } from '../pos/pos-types';
import { createCheckoutService } from './checkout-service';

const lines: CartLine[] = [{ id: 'uuid-1', productId: 'burger', name: 'Classic burger', salePriceCents: 1200, quantity: 2, addons: [], removedIngredients: [], notes: '' }];

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((next) => { resolve = next; }); return { promise, resolve }; }

describe('checkout service', () => {
  it('submits one atomic save while a first cash checkout is pending', async () => {
    const pending = deferred<{ id: string }>();
    const service = createCheckoutService({ gateway: { saveOrder: () => pending.promise }, newId: () => 'attempt-1' });
    const first = service.submitCashCardOrder({ lines, paymentMethod: 'cash', userId: 'staff-1' });
    await expect(service.submitCashCardOrder({ lines, paymentMethod: 'cash', userId: 'staff-1' })).resolves.toEqual({ kind: 'failed', message: 'Checkout is already in progress.' });
    pending.resolve({ id: 'order-1' });
    await expect(first).resolves.toMatchObject({ kind: 'saved', order: { id: 'order-1' } });
  });

  it('keeps a failed authoritative save retryable', async () => {
    const service = createCheckoutService({ gateway: { saveOrder: async () => { throw new Error('offline'); } }, newId: () => 'attempt-1' });
    await expect(service.submitCashCardOrder({ lines, paymentMethod: 'card', userId: 'staff-1' })).resolves.toEqual({ kind: 'failed', message: 'offline' });
  });

  it('serializes monetary values as dollars for the existing atomic RPC', async () => {
    const saveOrder = vi.fn().mockResolvedValue({ id: 'order-1' });
    const service = createCheckoutService({ gateway: { saveOrder }, newId: () => 'attempt-1' });
    await service.submitCashCardOrder({ lines, paymentMethod: 'card', userId: 'staff-1' });
    expect(saveOrder).toHaveBeenCalledWith(expect.objectContaining({
      orderId: null,
      order: expect.objectContaining({ subtotal: 24, total: 24, payment_method: 'card', payment_status: 'paid' }),
      items: [expect.objectContaining({ product_id: 'burger', base_price: 12, quantity: 2, subtotal: 24 })],
    }));
  });
});
