export interface DeliveryAddressInput {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postcode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

// Note: items type is flexible to allow different implementations
// In web app, it's CartItemData[], in mobile it might be different
export interface OrderInput {
  customer_email: string;
  customer_phone: string;
  customer_name?: string;
  payment_method: 'online' | 'store';
  order_type: 'pickup' | 'delivery';
  user_id?: string;
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
  delivery_quote_expires_at?: string;
  delivery_eta_minutes?: number;
  reward_points_used?: number;
  reward_points_value?: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_description: string | null;
  product_image_url: string | null;
  base_price: number;
  quantity: number;
  subtotal: number;
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
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_email: string;
  customer_phone: string;
  customer_name: string | null;
  payment_method: 'online' | 'store';
  order_type: 'pickup' | 'delivery';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  order_status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  subtotal: number;
  tax: number;
  delivery_fee: number;
  service_fee: number;
  total: number;
  reward_points_used: number | null;
  reward_points_value: number | null;
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
  delivery_quote_expires_at: string | null;
  delivery_eta_minutes: number | null;
  uber_delivery_id: string | null;
  delivery_status: string | null;
  delivery_tracking_url: string | null;
  delivery_driver_name: string | null;
  delivery_driver_phone: string | null;
  delivery_vehicle_info: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export type OrderStatus = Order['order_status'];
export type PaymentStatus = Order['payment_status'];
