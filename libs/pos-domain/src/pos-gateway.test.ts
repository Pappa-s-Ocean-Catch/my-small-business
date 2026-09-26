import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCompleteCatalog, saveInstoreOrder, type PosGateway } from './pos-gateway.js';

const source = {
  categories: [{ id: 'main', name: 'Main', active: true, sortOrder: 1 }],
  products: [{ id: 'burger', name: 'Burger', active: true, categoryId: 'main', subCategoryId: null, sortOrder: 1 }],
};

test('does not publish a partial catalogue when gateway loading fails', async () => {
  const gateway: PosGateway = {
    loadCatalog: async () => { throw new Error('network down'); },
    saveOrder: async () => ({ id: 'unused' }),
  };

  await assert.rejects(loadCompleteCatalog(gateway), /network down/);
});

test('delegates an in-store order to one atomic gateway operation', async () => {
  const calls: Array<{ orderId: string | null; order: Record<string, unknown>; items: unknown[] }> = [];
  const gateway: PosGateway = {
    loadCatalog: async () => source,
    saveOrder: async (input) => {
      calls.push(input);
      return { id: 'order-1' };
    },
  };

  const result = await saveInstoreOrder(gateway, {
    orderId: null,
    order: { order_type: 'instore' },
    items: [{ product_id: 'burger', quantity: 1 }],
  });

  assert.equal(result.id, 'order-1');
  assert.deepEqual(calls, [{ orderId: null, order: { order_type: 'instore' }, items: [{ product_id: 'burger', quantity: 1 }] }]);
});
