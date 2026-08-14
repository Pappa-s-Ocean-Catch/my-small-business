import assert from 'node:assert/strict';
import test from 'node:test';

import type { Order, OrderItem } from '@my-small-business/types';
import {
  createOrReusePendingInstoreOrder,
  getPendingInstorePaymentPlan,
  getPendingInstoreRewardPoints,
  getPendingInstoreOrderLockMessage,
  getSmartpayDisplayOrderNumber,
  settlePendingInstorePayment,
  type PendingInstoreOrderRequest,
} from '../lib/instore-smartpay-checkout';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'pending-order-1',
    order_number: 'ORD-123',
    user_id: null,
    receipt_claim_token: null,
    receipt_claimed_at: null,
    receipt_claimed_by_user_id: null,
    customer_email: '',
    customer_phone: '',
    customer_name: 'INSTORE',
    payment_method: 'store',
    order_channel: 'instore',
    payment_method_detail: 'SmartPay',
    order_type: 'pickup',
    payment_status: 'pending',
    order_status: 'pending_online_payment',
    subtotal: 12,
    tax: 1.2,
    delivery_fee: 0,
    service_fee: 0,
    promotion_discount: 0,
    promotions_applied: [],
    coupon_code: null,
    coupon_discount: 0,
    total: 13.2,
    marketplace_gross_sales: null,
    marketplace_gross_payout: null,
    marketplace_workflow_uuid: null,
    reward_points_used: null,
    reward_points_value: null,
    order_options: null,
    special_instructions: null,
    delivery_address_id: null,
    delivery_address_line1: null,
    delivery_address_line2: null,
    delivery_city: null,
    delivery_state: null,
    delivery_postcode: null,
    delivery_country: null,
    delivery_latitude: null,
    delivery_longitude: null,
    delivery_quote_id: null,
    delivery_quote_amount: null,
    delivery_quote_currency: null,
    delivery_partner_name: null,
    external_order_number: null,
    delivery_quote_expires_at: null,
    delivery_eta_minutes: null,
    delivery_provider_id: null,
    delivery_status: null,
    delivery_tracking_url: null,
    delivery_driver_name: null,
    delivery_driver_phone: null,
    delivery_driver_pin: null,
    delivery_vehicle_info: null,
    delivery_instructions: null,
    created_at: '2026-08-14T00:00:00.000Z',
    updated_at: '2026-08-14T00:00:00.000Z',
    scheduled_pickup_at: null,
    kitchen_print_claimed_at: null,
    kitchen_print_claimed_by: null,
    kitchen_print_completed_at: null,
    kitchen_print_completed_by: null,
    items: [],
    ...overrides,
  };
}

const cartItems: Array<Omit<OrderItem, 'id' | 'order_id' | 'created_at' | 'addons'>> = [{
  product_id: 'burger',
  product_name: 'Classic Burger',
  product_description: null,
  product_image_url: null,
  base_price: 12,
  override_price: null,
  quantity: 1,
  subtotal: 12,
  removed_ingredients: [],
  comment: null,
}];

const request: PendingInstoreOrderRequest = {
  orderPayload: makeOrder(),
  items: cartItems,
};

test('returns the friendly ticket number only for a persisted SmartPay order', () => {
  assert.equal(getSmartpayDisplayOrderNumber(makeOrder()), '123');
  assert.equal(getSmartpayDisplayOrderNumber(null), null);
});

test('retries settlement without starting another terminal purchase after approval', () => {
  const pendingOrder = makeOrder();

  assert.deepEqual(
    getPendingInstorePaymentPlan(pendingOrder, pendingOrder.id, 'smartpay'),
    { detail: 'SmartPay', shouldStartTerminal: false },
  );
});

test('does not relabel or duplicate a pending order after SmartPay approval', () => {
  const pendingOrder = makeOrder();

  assert.throws(
    () => getPendingInstorePaymentPlan(pendingOrder, pendingOrder.id, 'cash'),
    /already approved by SmartPay/,
  );
  assert.throws(
    () => getPendingInstorePaymentPlan(pendingOrder, null, 'unpaid'),
    /already persisted/,
  );
});

test('locks alternate checkout paths and keeps the persisted reward redemption', () => {
  const pendingOrder = makeOrder({ reward_points_used: 275 });

  assert.match(getPendingInstoreOrderLockMessage(pendingOrder) ?? '', /Order #123/);
  assert.equal(getPendingInstoreOrderLockMessage(null), null);
  assert.equal(getPendingInstoreRewardPoints(pendingOrder), 275);
});

test('saves one pending in-store order before SmartPay starts', async () => {
  const saveCalls: Array<{ orderPayload: Record<string, unknown>; items: unknown[] }> = [];
  const savedOrder = makeOrder();

  const result = await createOrReusePendingInstoreOrder({
    savePosOrder: async (orderPayload, items) => {
      saveCalls.push({
        orderPayload: orderPayload as Record<string, unknown>,
        items,
      });
      return { data: savedOrder, error: null };
    },
  }, request);

  assert.equal(result.created, true);
  assert.equal(result.order, savedOrder);
  assert.equal(saveCalls.length, 1);
  assert.equal(saveCalls[0].orderPayload.order_channel, 'instore');
  assert.equal(saveCalls[0].orderPayload.payment_method, 'store');
  assert.equal(saveCalls[0].orderPayload.payment_status, 'pending');
  assert.equal(saveCalls[0].orderPayload.payment_method_detail, 'SmartPay');
  assert.equal(saveCalls[0].orderPayload.order_status, 'pending_online_payment');
  assert.deepEqual(saveCalls[0].items, cartItems);
});

test('reuses the pending order for retry and cash fallback', async () => {
  const pendingOrder = makeOrder();
  const updateCalls: Array<[string, 'paid', 'SmartPay' | 'Cash' | 'Card']> = [];
  const settledOrder = makeOrder({
    payment_status: 'paid',
    payment_method_detail: 'Cash',
    order_status: 'confirmed',
  });

  const result = await createOrReusePendingInstoreOrder({
    savePosOrder: async () => {
      throw new Error('a retry must not save a second order');
    },
  }, { ...request, existingOrder: pendingOrder });
  const settlement = await settlePendingInstorePayment({
    updatePaymentStatus: async (orderId, paymentStatus, detail) => {
      assert.equal(paymentStatus, 'paid');
      updateCalls.push([orderId, paymentStatus, detail as 'SmartPay' | 'Cash' | 'Card']);
      return { data: settledOrder, error: null };
    },
  }, result.order.id, 'Cash');

  assert.equal(result.created, false);
  assert.equal(result.order, pendingOrder);
  assert.equal(settlement, settledOrder);
  assert.deepEqual(updateCalls, [[pendingOrder.id, 'paid', 'Cash']]);
});

test('does not treat a missing settlement result as paid', async () => {
  await assert.rejects(
    settlePendingInstorePayment({
      updatePaymentStatus: async () => ({ data: null, error: null }),
    }, 'pending-order-1', 'SmartPay'),
    /Failed to settle pending SmartPay order/,
  );
});
