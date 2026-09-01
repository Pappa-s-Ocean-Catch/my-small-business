import assert from 'node:assert/strict';
import Module from 'node:module';
import test from 'node:test';

const marketplaceOrders = [{
  id: 'order-1',
  order_number: 'ORD-1',
  user_id: 'marketplace-profile-1',
  customer_name: 'Marketplace customer',
  customer_email: '',
  customer_phone: '',
  created_at: '2026-08-31T01:00:00.000Z',
  total: 24.5,
  order_status: 'completed',
}];

const originalLoad = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = (request: unknown, parent: unknown, isMain: unknown) => {
  if (request === '@/lib/supabase') {
    return {
      supabase: {
        from(table: string) {
          if (table === 'orders') {
            const query = {
              select: () => query,
              order: () => query,
              eq: (column: string, value: string) => {
                assert.equal(column, 'user_id');
                assert.equal(value, 'marketplace-profile-1');
                return Promise.resolve({ data: marketplaceOrders, error: null });
              },
              or: () => {
                throw new Error('A profile-linked marketplace customer must not fall back to contact matching.');
              },
            };
            return query;
          }

          const query = {
            select: () => query,
            eq: () => query,
            order: () => query,
            limit: () => Promise.resolve({ data: [], error: null }),
          };
          return query;
        },
      },
    };
  }
  return originalLoad(request, parent, isMain);
};

const { fetchCustomerSummary } = require('../utils/customerSummary') as typeof import('../utils/customerSummary');

test('loads a marketplace customer and all linked orders by profile ID without contact details', async () => {
  const summary = await fetchCustomerSummary({ profileId: 'marketplace-profile-1' });

  assert.deepEqual(summary?.orders, [{
    id: 'order-1',
    orderNumber: 'ORD-1',
    date: '2026-08-31T01:00:00.000Z',
    total: 24.5,
    status: 'completed',
  }]);
  assert.equal(summary?.profileId, 'marketplace-profile-1');
  assert.equal(summary?.totalOrders, 1);
});
