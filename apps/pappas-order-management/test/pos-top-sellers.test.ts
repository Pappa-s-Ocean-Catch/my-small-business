import assert from 'node:assert/strict';
import test from 'node:test';

type SaleRow = {
  productId: string | null;
  quantity: number | null;
  orderId: string | null;
  orderStatus: string | null;
};

test('ranks the twelve highest-selling non-cancelled products by today cart quantity', async () => {
  const modulePath = '../lib/pos-top-sellers.js';
  const { rankTopSellers } = await import(modulePath) as {
    rankTopSellers: (rows: SaleRow[]) => Array<{ productId: string; quantitySold: number; orderCount: number }>;
  };

  const rows: SaleRow[] = [
    ...Array.from({ length: 13 }, (_, index) => ({
      productId: `product-${index + 1}`,
      quantity: 14 - index,
      orderId: `order-${index + 1}`,
      orderStatus: 'completed',
    })),
    { productId: 'product-1', quantity: 3, orderId: 'order-1b', orderStatus: 'completed' },
    { productId: 'cancelled-product', quantity: 99, orderId: 'cancelled-order', orderStatus: 'cancelled' },
  ];

  assert.deepEqual(rankTopSellers(rows), [
    { productId: 'product-1', quantitySold: 17, orderCount: 2 },
    { productId: 'product-2', quantitySold: 13, orderCount: 1 },
    { productId: 'product-3', quantitySold: 12, orderCount: 1 },
    { productId: 'product-4', quantitySold: 11, orderCount: 1 },
    { productId: 'product-5', quantitySold: 10, orderCount: 1 },
    { productId: 'product-6', quantitySold: 9, orderCount: 1 },
    { productId: 'product-7', quantitySold: 8, orderCount: 1 },
    { productId: 'product-8', quantitySold: 7, orderCount: 1 },
    { productId: 'product-9', quantitySold: 6, orderCount: 1 },
    { productId: 'product-10', quantitySold: 5, orderCount: 1 },
    { productId: 'product-11', quantitySold: 4, orderCount: 1 },
    { productId: 'product-12', quantitySold: 3, orderCount: 1 },
  ]);
});

test('uses Melbourne midnight boundaries for today sales', async () => {
  const modulePath = '../lib/pos-top-sellers.js';
  const { getMelbourneTodayRange } = await import(modulePath) as {
    getMelbourneTodayRange: (now: Date) => { startIso: string; endIso: string };
  };

  assert.deepEqual(getMelbourneTodayRange(new Date('2026-09-22T14:30:00.000Z')), {
    startIso: '2026-09-22T14:00:00.000Z',
    endIso: '2026-09-23T14:00:00.000Z',
  });
});
