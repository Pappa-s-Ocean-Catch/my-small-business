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
  orderUUID: 'workflow-ue-123',
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
  marketplace_workflow_uuid: 'existing-workflow-uuid',
  special_instructions: 'Staff note — preserve this',
  items: [{ id: 'staff-item' }],
} as unknown as Order;

const choicesGroupMapping = {
  provider: 'uber_eats' as const,
  entity_type: 'addon_group' as const,
  external_name: 'Choices',
  normalized_external_name: 'choices',
  parent_normalized_external_name: 'classic burger',
  internal_name: 'Extras',
  internal_entity_id: 'extras',
  is_active: true,
};

type MarketplaceUpdateCall = {
  orderId: string;
  update: Record<string, unknown>;
};

function createExistingOrderService(
  existing: Order,
  updateCalls: MarketplaceUpdateCall[]
) {
  return createMarketplacePosOrderService({
    findMarketplaceOrder: async (provider, externalOrderId) => {
      assert.equal(provider, 'uber_eats');
      assert.equal(externalOrderId, 'UE-123');
      return { data: existing, error: null };
    },
    savePosOrder: async () => {
      throw new Error('existing imports must not be recreated');
    },
    updateMarketplaceOrder: async (orderId, update) => {
      const payload = update as unknown as Record<string, unknown>;
      updateCalls.push({ orderId, update: payload });
      return {
        data: { ...existing, order_status: update.order_status },
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
}

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
    loadMappings: async () => [choicesGroupMapping],
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
  assert.equal(saveCalls[0].orderPayload.marketplace_workflow_uuid, 'workflow-ue-123');
  assert.deepEqual(saveCalls[0].items[0].removed_ingredients, ['Tomato']);
  assert.equal((saveCalls[0].items[0].addons as unknown[]).length, 1);
});

test('imports No Salt as an exact POS add-on before treating it as an ingredient removal', async () => {
  const savedOrder = { ...existingOrder, id: 'pos-no-salt', order_status: 'ready' } as Order;
  const saveCalls: Array<{ items: Array<Record<string, unknown>> }> = [];
  const service = createMarketplacePosOrderService({
    findMarketplaceOrder: async () => ({ data: null, error: null }),
    savePosOrder: async (_orderPayload, items) => {
      saveCalls.push({ items: items as unknown as Array<Record<string, unknown>> });
      return { data: savedOrder, error: null };
    },
    updateMarketplaceOrder: async () => {
      throw new Error('a new order must not enter the update path');
    },
    loadCatalog: async () => ({
      products: [{
        id: 'burger', name: 'Classic Burger', description: 'Beef burger', section: 'Grilled',
        search_term: null, sale_price: 20, image_url: null, sale_category_id: 'mains',
        sub_category_id: null, sort_order: 1, is_active: true,
      }],
      categories: [{ id: 'mains', section: 'Grilled' }],
    }),
    loadMappings: async () => [choicesGroupMapping],
    loadProductCustomizations: async () => ({
      groups: [{
        id: 'extras', name: 'Extras', is_required: false, multiple_choice: true, display_order: 1,
        items: [{
          id: 'no-salt', addon_group_id: 'extras', name: 'No Salt', extra_price: 0,
          section: null, sort_order: 1, is_active: true,
        }],
      }],
      removableIngredients: [
        { id: 'salt', ingredient_name: 'Salt', customer_can_remove: true },
        { id: 'tomato', ingredient_name: 'Tomato', customer_can_remove: true },
      ],
    }),
    recordUnmatchedName: async () => undefined,
    createLocalId: () => 'local-item',
    now: () => new Date('2026-08-02T00:00:00.000Z'),
  });

  const result = await service.importMarketplaceOrder({
    ...detail,
    items: [{
      ...detail.items[0],
      customizations: [{
        name: 'Choices',
        options: [
          { name: 'No   Salt', quantity: 1, price: null },
          { name: 'No Tomato', quantity: 1, price: null },
        ],
      }],
    }],
  });

  assert.equal(result.created, true);
  assert.equal(result.error, null);
  assert.equal(saveCalls.length, 1);
  assert.deepEqual(saveCalls[0].items[0].removed_ingredients, ['Tomato']);
  const addons = saveCalls[0].items[0].addons as Array<Record<string, unknown>>;
  assert.equal(addons.length, 1);
  assert.equal(addons[0].addon_item_id, 'no-salt');
  assert.equal(addons[0].addon_item_name, 'No Salt');
});

test('uses an explicit No Salt add-on mapping before removal processing', async () => {
  const savedOrder = { ...existingOrder, id: 'pos-mapped-no-salt', order_status: 'ready' } as Order;
  const saveCalls: Array<{ items: Array<Record<string, unknown>> }> = [];
  const service = createMarketplacePosOrderService({
    findMarketplaceOrder: async () => ({ data: null, error: null }),
    savePosOrder: async (_orderPayload, items) => {
      saveCalls.push({ items: items as unknown as Array<Record<string, unknown>> });
      return { data: savedOrder, error: null };
    },
    updateMarketplaceOrder: async () => {
      throw new Error('a new order must not enter the update path');
    },
    loadCatalog: async () => ({
      products: [{
        id: 'burger', name: 'Classic Burger', description: 'Beef burger', section: 'Grilled',
        search_term: null, sale_price: 20, image_url: null, sale_category_id: 'mains',
        sub_category_id: null, sort_order: 1, is_active: true,
      }],
      categories: [{ id: 'mains', section: 'Grilled' }],
    }),
    loadMappings: async () => [choicesGroupMapping, {
      provider: 'uber_eats', entity_type: 'addon', external_name: 'No Salt',
      normalized_external_name: 'no salt', internal_name: 'No Salt Light', is_active: true,
    }],
    loadProductCustomizations: async () => ({
      groups: [{
        id: 'extras', name: 'Extras', is_required: false, multiple_choice: true, display_order: 1,
        items: [{
          id: 'no-salt-light', addon_group_id: 'extras', name: 'No Salt Light', extra_price: 0,
          section: null, sort_order: 1, is_active: true,
        }],
      }],
      removableIngredients: [{ id: 'salt', ingredient_name: 'Salt', customer_can_remove: true }],
    }),
    recordUnmatchedName: async () => undefined,
    createLocalId: () => 'local-item',
    now: () => new Date('2026-08-02T00:00:00.000Z'),
  });

  const result = await service.importMarketplaceOrder({
    ...detail,
    items: [{
      ...detail.items[0],
      customizations: [{
        name: 'Choices',
        options: [{ name: 'No Salt', quantity: 1, price: null }],
      }],
    }],
  });

  assert.equal(result.created, true);
  assert.equal(result.error, null);
  assert.equal(saveCalls.length, 1);
  assert.deepEqual(saveCalls[0].items[0].removed_ingredients, []);
  const addons = saveCalls[0].items[0].addons as Array<Record<string, unknown>>;
  assert.equal(addons.length, 1);
  assert.equal(addons[0].addon_item_id, 'no-salt-light');
  assert.equal(addons[0].addon_item_name, 'No Salt Light');
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
    loadMappings: async () => [choicesGroupMapping],
    loadProductCustomizations: async () => ({
      groups: [{ id: 'extras', name: 'Extras', is_required: false, multiple_choice: true, display_order: 1, items: [] }],
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

test('imports a matched product and retains an unmatched add-on as a note', async () => {
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
    loadMappings: async () => [choicesGroupMapping],
    loadProductCustomizations: async () => ({
      groups: [{ id: 'extras', name: 'Extras', is_required: false, multiple_choice: true, display_order: 1, items: [] }],
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
  assert.equal(result.error, null);
  assert.equal(saveCalls, 1);
});

test('records unmatched add-on quantity and price in the product note', async () => {
  const service = createMarketplacePosOrderService({
    findMarketplaceOrder: async () => ({ data: null, error: null }),
    savePosOrder: async () => ({ data: existingOrder, error: null }),
    updateMarketplaceOrder: async () => ({ data: existingOrder, error: null }),
    loadCatalog: async () => ({
      products: [{
        id: 'burger', name: 'Classic Burger', description: null, section: null, search_term: null,
        sale_price: 20, image_url: null, sale_category_id: null, sub_category_id: null, sort_order: 1, is_active: true,
      }],
      categories: [],
    }),
    loadMappings: async () => [choicesGroupMapping],
    loadProductCustomizations: async () => ({ groups: [{ id: 'extras', name: 'Extras', is_required: false, multiple_choice: true, display_order: 1, items: [] }], removableIngredients: [] }),
    recordUnmatchedName: async () => undefined,
    createLocalId: () => 'local-item',
    now: () => new Date('2026-08-02T00:00:00.000Z'),
  });

  const draft = await service.buildMarketplacePosOrderDraft({
    ...detail,
    items: [{
      ...detail.items[0],
      customizations: [{ name: 'Choices', options: [{ name: 'Extra Cheese', quantity: 1, price: '$2.00' }] }],
    }],
  });

  assert.deepEqual(draft.unresolvedIssues, []);
  assert.equal(draft.cartItems[0].comment, 'Cut in half\nAdd-on: Extra Cheese (+$2.00)');
});

test('updates only order_status when the provider and trimmed ID already exist', async () => {
  const updateCalls: MarketplaceUpdateCall[] = [];
  const service = createExistingOrderService(existingOrder, updateCalls);

  const result = await service.importMarketplaceOrder({
    ...detail,
    orderJobState: 'PICKED_UP',
    statusDescription: 'Driver is on the way',
  });

  assert.equal(result.created, false);
  assert.equal(result.error, null);
  assert.equal(result.order?.order_status, 'on_the_way');
  assert.equal(result.order?.marketplace_workflow_uuid, 'existing-workflow-uuid');
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
    'marketplace_workflow_uuid',
    'customer_name',
    'customer_phone',
    'order_options',
    'special_instructions',
  ]) {
    assert.equal(forbiddenField in updateCalls[0].update, false, forbiddenField);
  }
});

test('keeps local preparing or ready status when upstream has not advanced it', async () => {
  const upstreamStates = [
    { orderJobState: 'CONFIRMED', statusDescription: 'Confirmed' },
    { orderJobState: 'PREPARING', statusDescription: 'Preparing' },
    { orderJobState: 'READY_FOR_PICKUP', statusDescription: 'Ready for pickup' },
  ];

  for (const localStatus of ['preparing', 'ready'] as const) {
    for (const upstream of upstreamStates) {
      const localOrder = { ...existingOrder, order_status: localStatus } as Order;
      const updateCalls: MarketplaceUpdateCall[] = [];
      const service = createExistingOrderService(localOrder, updateCalls);

      const result = await service.syncMarketplaceOrderStatus(
        'uber_eats',
        ' UE-123 ',
        { ...detail, ...upstream }
      );

      assert.equal(result.order, localOrder, `${localStatus} / ${upstream.orderJobState}`);
      assert.deepEqual(updateCalls, [], `${localStatus} / ${upstream.orderJobState}`);
    }
  }
});

test('keeps local on-the-way status when history has no later lifecycle state', async () => {
  const localOrder = { ...existingOrder, order_status: 'on_the_way' } as Order;
  const updateCalls: MarketplaceUpdateCall[] = [];
  const service = createExistingOrderService(localOrder, updateCalls);

  const result = await service.syncMarketplaceOrderStatus(
    'uber_eats',
    'UE-123',
    {
      ...detail,
      orderJobState: null,
      statusDescription: null,
      orderStateChanges: [],
    }
  );

  assert.equal(result.order, localOrder);
  assert.deepEqual(updateCalls, []);
});

test('applies upstream delivery and terminal status changes to a local preparing order', async () => {
  const upstreamStates = [
    { orderJobState: 'PICKED_UP', statusDescription: 'Driver is on the way', status: 'on_the_way' },
    { orderJobState: 'COMPLETED', statusDescription: 'Completed', status: 'completed' },
    { orderJobState: 'CANCELLED', statusDescription: 'Cancelled', status: 'cancelled' },
    { orderJobState: 'REFUNDED', statusDescription: 'Refunded', status: 'refunded' },
  ] as const;

  for (const upstream of upstreamStates) {
    const localOrder = { ...existingOrder, order_status: 'preparing' } as Order;
    const updateCalls: MarketplaceUpdateCall[] = [];
    const service = createExistingOrderService(localOrder, updateCalls);

    const result = await service.syncMarketplaceOrderStatus(
      'uber_eats',
      'UE-123',
      { ...detail, ...upstream }
    );

    assert.equal(result.order?.order_status, upstream.status, upstream.orderJobState);
    assert.deepEqual(updateCalls, [{
      orderId: 'pos-existing',
      update: { order_status: upstream.status },
    }], upstream.orderJobState);
  }
});

test('does not reopen terminal local marketplace orders', async () => {
  for (const localStatus of ['completed', 'cancelled', 'refunded'] as const) {
    const localOrder = { ...existingOrder, order_status: localStatus } as Order;
    const updateCalls: MarketplaceUpdateCall[] = [];
    const service = createExistingOrderService(localOrder, updateCalls);

    const result = await service.syncMarketplaceOrderStatus(
      'uber_eats',
      'UE-123',
      {
        ...detail,
        orderJobState: 'PICKED_UP',
        statusDescription: 'Driver is on the way',
      }
    );

    assert.equal(result.order, localOrder, localStatus);
    assert.deepEqual(updateCalls, [], localStatus);
  }
});
