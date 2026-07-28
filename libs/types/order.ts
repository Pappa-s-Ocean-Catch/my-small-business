export interface DeliveryAddressInput {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postcode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  delivery_instructions?: string;
}

export type OrderChannel = 'online' | 'phone_pickup' | 'phone_delivery' | 'instore' | 'third_party';

// Note: items type is flexible to allow different implementations
// In web app, it's CartItemData[], in mobile it might be different
export interface OrderInput {
  customer_email: string;
  customer_phone: string;
  customer_name?: string;
  payment_method: 'online' | 'store';
  order_channel?: OrderChannel;
  order_type: 'pickup' | 'delivery';
  user_id?: string;
  order_options?: string | null;
  special_instructions?: string;
  items: any[]; // Flexible type - can be CartItemData[] or other formats
  subtotal: number;
  tax?: number;
  delivery_fee?: number;
  service_fee?: number;
  total: number;
  delivery_address_id?: string;
  delivery_address?: DeliveryAddressInput;
  delivery_quote_id?: string;
  delivery_quote_amount?: number;
  delivery_quote_currency?: string;
  delivery_partner_name?: string | null;
  delivery_quote_expires_at?: string | null;
  delivery_eta_minutes?: number | null;
  reward_points_used?: number;
  reward_points_value?: number;
  delivery_instructions?: string;

  // Promotions (optional)
  promotion_discount?: number;
  promotions_applied?: any[];
  coupon_code?: string | null;
  coupon_discount?: number;

  /** When the customer wants to pick up (for pickup orders). Required when ordering outside open hours (pre-order). */
  scheduled_pickup_at?: string | null; // ISO datetime
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_description: string | null;
  product_image_url: string | null;
  base_price: number;
  override_price: number | null;
  quantity: number;
  subtotal: number;
  section?: string | null;
  removed_ingredients: string[];
  comment: string | null;
  created_at: string;
  addons?: OrderItemAddon[];
}

export interface OrderItemAddon {
  id: string;
  order_item_id: string;
  addon_group_id: string;
  addon_group_name: string;
  addon_item_id: string;
  addon_item_name: string;
  addon_item_price: number;
  section?: string | null;
  created_at: string;
  /**
   * Controls display ordering in receipts / confirmation screens.
   * Mapped from `addon_items.sort_order` until a dedicated DB column exists.
   */
  display_order?: number;
  /**
   * Order for the parent add-on group (mapped from `addon_groups.sort_order`).
   * Useful when you want to control ordering at the group level.
   */
  display_group_order?: number;
  /** Whether this add-on group is required (from `addon_groups.is_required`). */
  is_required?: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  receipt_claim_token: string | null;
  receipt_claimed_at: string | null;
  receipt_claimed_by_user_id: string | null;
  customer_email: string;
  customer_phone: string;
  customer_name: string | null;
  payment_method: 'online' | 'store';
  order_channel: OrderChannel;
  /** Optional tender detail for in-store payments (e.g. 'cash', 'card', 'eftpos'). */
  payment_method_detail: string | null;
  order_type: 'pickup' | 'delivery';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  order_status: 'pending' | 'pending_online_payment' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  subtotal: number;
  tax: number;
  delivery_fee: number;
  service_fee: number;
  promotion_discount: number;
  promotions_applied: any[];
  coupon_code: string | null;
  coupon_discount: number;
  total: number;
  reward_points_used: number | null;
  reward_points_value: number | null;
  order_options: string | null;
  special_instructions: string | null;
  delivery_address_id: string | null;
  delivery_address_line1: string | null;
  delivery_address_line2: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_postcode: string | null;
  delivery_country: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  delivery_quote_id: string | null;
  delivery_quote_amount: number | null;
  delivery_quote_currency: string | null;
  delivery_partner_name: string | null;
  external_order_number: string | null;
  delivery_quote_expires_at: string | null;
  delivery_eta_minutes: number | null;
  delivery_provider_id: string | null;
  delivery_status: string | null;
  delivery_tracking_url: string | null;
  delivery_driver_name: string | null;
  delivery_driver_phone: string | null;
  delivery_driver_pin: string | null;
  delivery_vehicle_info: string | null;
  delivery_instructions: string | null;
  created_at: string;
  updated_at: string;
  scheduled_pickup_at: string | null;
  kitchen_print_claimed_at: string | null;
  kitchen_print_claimed_by: string | null;
  kitchen_print_completed_at: string | null;
  kitchen_print_completed_by: string | null;
  items?: OrderItem[];
}

export interface OrderEvent {
  id: string;
  order_id: string | null;
  source: string;
  event_type: string;
  status: string | null;
  message: string | null;
  external_order_number: string | null;
  external_delivery_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export type OrderStatus = Order['order_status'];
export type PaymentStatus = Order['payment_status'];
