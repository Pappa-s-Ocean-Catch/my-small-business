import test from 'node:test';
import assert from 'node:assert/strict';
import type { Order } from '@my-small-business/types';
import { generatePrintHTML } from '../utils/orderUtils';

const baseOrder: Order = {
  id: 'order-1',
  order_number: 'ORD-20260728-001',
  user_id: null,
  receipt_claim_token: null,
  receipt_claimed_at: null,
  receipt_claimed_by_user_id: null,
  customer_email: '',
  customer_phone: '000',
  customer_name: 'Uber Eats',
  payment_method: 'store',
  order_channel: 'third_party',
  payment_method_detail: 'Uber Eats',
  order_type: 'pickup',
  payment_status: 'paid',
  order_status: 'confirmed',
  subtotal: 21,
  tax: 0,
  delivery_fee: 0,
  service_fee: 0,
  promotion_discount: 0,
  promotions_applied: [],
  coupon_code: null,
  coupon_discount: 0,
  total: 21,
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
  delivery_partner_name: 'Uber Eats',
  external_order_number: 'UE-123',
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
  created_at: '2026-07-28T10:00:00.000Z',
  updated_at: '2026-07-28T10:00:00.000Z',
  scheduled_pickup_at: null,
  kitchen_print_claimed_at: null,
  kitchen_print_claimed_by: null,
  kitchen_print_completed_at: null,
  kitchen_print_completed_by: null,
  items: [
    {
      id: 'item-1',
      order_id: 'order-1',
      product_id: 'product-1',
      product_name: 'Fish Burger',
      product_description: null,
      product_image_url: null,
      base_price: 12,
      override_price: null,
      quantity: 2,
      subtotal: 21,
      removed_ingredients: [],
      comment: null,
      created_at: '2026-07-28T10:00:00.000Z',
      addons: [],
    },
  ],
};

test('generatePrintHTML prefers overridePrice for marketplace items when present', () => {
  const orderWithOverride = {
    ...baseOrder,
    items: [
      {
        ...baseOrder.items![0],
        override_price: 19.5,
      },
    ],
  };

  const html = generatePrintHTML(orderWithOverride);

  assert.match(html, /\$19\.50/);
  assert.doesNotMatch(html, /\$21\.00/);
});
