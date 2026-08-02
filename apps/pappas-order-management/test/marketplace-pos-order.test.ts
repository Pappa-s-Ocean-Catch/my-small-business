import assert from 'node:assert/strict';
import test from 'node:test';

import type { Order } from '@my-small-business/types';
import {
  createMarketplacePosOrderService,
  findMarketplaceOrderIdByExternalId,
} from '../lib/marketplace-pos-order';

type MarketplaceOrderDetailInput = Parameters<
  ReturnType<typeof createMarketplacePosOrderService>['importMarketplaceOrder']
>[0];

const detail: MarketplaceOrderDetailInput = {
  provider: 'uber_eats',
  sourceName: 'Uber Eats',
  orderId: '  UE-123  ',
  requestedAt: 1_754_000_000_000,
  customerName: 'Alex Customer',
  subtotalAmount: 25,
  discountAmount: 0,
  totalAmount: 25,
  netPayout: '$18.50',
  orderJobState: 'READY_FOR_PICKUP',
  statusDescription: 'Ready for courier',
  orderStateChanges: [],
  items: [{
    name: 'Classic Burger',
    price: '$25.00',
    quantity: 1,
    specialInstructions: 'Cut in half',
    customizations: [{
      name: 'Choices',
      options: [
        { name: 'Extra Cheese', quantity: 1, price: '$2.00' },
        { name: 'No Tomato', quantity: 1, price: null },
      ],
    }],
  }],
};

const existingOrder = {
  id: 'pos-existing',
  order_status: 'preparing',
  customer_name: 'Staff corrected name',
  total: 99,
  marketplace_gross_sales: 25,
  marketplace_gross_payout: 18.5,
  special_instructions: 'Staff note — preserve this',
  items: [{ id: 'staff-item' }],
} as unknown as Order;

test('matches a stored marketplace ID using its trimmed identity', () => {
  assert.equal(findMarketplaceOrderIdByExternalId([
    { id: 'other', external_order_number: 'UE-456' },
    { id: 'match', external_order_number: '  UE-123  ' },
  ], 'UE-123'), 'match');
});

test('imports a new marketplace detail through savePosOrder exactly once', async () => {
  const saveCalls: Array<{ orderPayload: Record<string, unknown>; items: Array<Record<string, unknown>> }> = [];
  const savedOrder = { ...existingOrder, id: 'pos-new', order_status: 'ready' } as Order;

  const service = createMarketplacePosOrderService({
    findMarketplaceOrder: async (provider, externalOrderId) => {
      assert.equal(provider, 'uber_eats');
      assert.equal(externalOrderId, 'UE-123');
      return { data: null, error: null };
    },
    savePosOrder: async (orderPayload, items) => {
      saveCalls.push({
        orderPayload: orderPayload as unknown as Record<string, unknown>,
        items: items as unknown as Array<Record<string, unknown>>,
      });
      return { data: savedOrder, error: null };
    },
    updateMarketplaceOrder: async () => {
      throw new Error('new imports must not update an existing order');
    },
    loadCatalog: async () => ({
      products: [{
        id: 'burger',
        name: 'Classic Burger',
        description: 'Beef burger',
        section: 'Grilled',
        search_term: null,
        sale_price: 20,
        image_url: null,
        sale_category_id: 'mains',
        sub_category_id: null,
        sort_order: 1,
        is_active: true,
      }],
      categories: [{ id: 'mains', section: 'Grilled' }],
    }),
    loadMappings: async () => [],
    loadProductCustomizations: async () => ({
      groups: [{
        id: 'extras',
        name: 'Extras',
        is_required: false,
        multiple_choice: true,
        display_order: 1,
        items: [{
          id: 'cheese',
          addon_group_id: 'extras',
          name: 'Extra Cheese',
          extra_price: 2,
          section: null,
          sort_order: 1,
          is_active: true,
        }],
      }],
      removableIngredients: [{
        id: 'tomato',
        ingredient_name: 'Tomato',
        customer_can_remove: true,
      }],
    }),
    recordUnmatchedName: async () => undefined,
    createLocalId: () => 'local-item',
    now: () => new Date('2026-08-02T00:00:00.000Z'),
  });

  const result = await service.importMarketplaceOrder(detail);

  assert.equal(result.created, true);
  assert.equal(result.order, savedOrder);
  assert.equal(result.error, null);
  assert.equal(saveCalls.length, 1);
  assert.equal(saveCalls[0].orderPayload.order_status, 'ready');
  assert.equal(saveCalls[0].orderPayload.marketplace_gross_sales, 25);
  assert.equal(saveCalls[0].orderPayload.marketplace_gross_payout, 18.5);
  assert.equal(saveCalls[0].orderPayload.external_order_number, 'UE-123');
  assert.deepEqual(saveCalls[0].items[0].removed_ingredients, ['Tomato']);
  assert.equal((saveCalls[0].items[0].addons as unknown[]).length, 1);
});

test('does not create an order when required customization data fails to load', async () => {
  let saveCalls = 0;
  const service = createMarketplacePosOrderService({
    findMarketplaceOrder: async () => ({ data: null, error: null }),
    savePosOrder: async () => {
      saveCalls += 1;
      return { data: existingOrder, error: null };
    },
    updateMarketplaceOrder: async () => {
      throw new Error('a new order must not enter the update path');
    },
    loadCatalog: async () => ({
      products: [{
        id: 'burger',
        name: 'Classic Burger',
        description: 'Beef burger',
        section: 'Grilled',
        search_term: null,
        sale_price: 20,
        image_url: null,
        sale_category_id: 'mains',
        sub_category_id: null,
        sort_order: 1,
        is_active: true,
      }],
      categories: [{ id: 'mains', section: 'Grilled' }],
    }),
    loadMappings: async () => [],
    loadProductCustomizations: async () => ({
      groups: [],
      removableIngredients: [],
      error: 'Marketplace customizations unavailable',
    }),
    recordUnmatchedName: async () => undefined,
    createLocalId: () => 'local-item',
    now: () => new Date('2026-08-02T00:00:00.000Z'),
  });

  const result = await service.importMarketplaceOrder(detail);

  assert.equal(result.created, false);
  assert.equal(result.error, 'Marketplace customizations unavailable');
  assert.equal(saveCalls, 0);
});

test('does not automatically create a partially matched marketplace order', async () => {
  let saveCalls = 0;
  const service = createMarketplacePosOrderService({
    findMarketplaceOrder: async () => ({ data: null, error: null }),
    savePosOrder: async () => {
      saveCalls += 1;
      return { data: existingOrder, error: null };
    },
    updateMarketplaceOrder: async () => {
      throw new Error('a new order must not enter the update path');
    },
    loadCatalog: async () => ({
      products: [{
        id: 'burger',
        name: 'Classic Burger',
        description: 'Beef burger',
        section: 'Grilled',
        search_term: null,
        sale_price: 20,
        image_url: null,
        sale_category_id: 'mains',
        sub_category_id: null,
        sort_order: 1,
        is_active: true,
      }],
      categories: [{ id: 'mains', section: 'Grilled' }],
    }),
    loadMappings: async () => [],
    loadProductCustomizations: async () => ({
      groups: [],
      removableIngredients: [{
        id: 'tomato',
        ingredient_name: 'Tomato',
        customer_can_remove: true,
      }],
    }),
    recordUnmatchedName: async () => undefined,
    createLocalId: () => 'local-item',
    now: () => new Date('2026-08-02T00:00:00.000Z'),
  });

  const result = await service.importMarketplaceOrder(detail);

  assert.equal(result.created, false);
  assert.equal(
    result.error,
    'Marketplace order needs manual review before import. Unmatched products: none. Unmatched options: Classic Burger: Extra Cheese.'
  );
  assert.equal(saveCalls, 0);
});

test('updates only order_status when the provider and trimmed ID already exist', async () => {
  const updateCalls: Array<{ orderId: string; update: Record<string, unknown> }> = [];

  const service = createMarketplacePosOrderService({
    findMarketplaceOrder: async (provider, externalOrderId) => {
      assert.equal(provider, 'uber_eats');
      assert.equal(externalOrderId, 'UE-123');
      return { data: existingOrder, error: null };
    },
    savePosOrder: async () => {
      throw new Error('existing imports must not be recreated');
    },
    updateMarketplaceOrder: async (orderId, update) => {
      const payload = update as unknown as Record<string, unknown>;
      updateCalls.push({ orderId, update: payload });
      return {
        data: { ...existingOrder, order_status: update.order_status },
        error: null,
      };
    },
    loadCatalog: async () => {
      throw new Error('existing imports must not rebuild items');
    },
    loadMappings: async () => {
      throw new Error('existing imports must not reload mappings');
    },
    loadProductCustomizations: async () => {
      throw new Error('existing imports must not reload customizations');
    },
    recordUnmatchedName: async () => {
      throw new Error('existing imports must not write unmatched names');
    },
    createLocalId: () => 'unused',
    now: () => new Date('2026-08-02T00:00:00.000Z'),
  });

  const result = await service.importMarketplaceOrder({
    ...detail,
    orderJobState: 'PICKED_UP',
    statusDescription: 'Driver is on the way',
  });

  assert.equal(result.created, false);
  assert.equal(result.error, null);
  assert.equal(result.order?.order_status, 'on_the_way');
  assert.deepEqual(updateCalls, [{
    orderId: 'pos-existing',
    update: { order_status: 'on_the_way' },
  }]);

  for (const forbiddenField of [
    'items',
    'subtotal',
    'total',
    'marketplace_gross_sales',
    'marketplace_gross_payout',
    'customer_name',
    'customer_phone',
    'order_options',
    'special_instructions',
  ]) {
    assert.equal(forbiddenField in updateCalls[0].update, false, forbiddenField);
  }
});
