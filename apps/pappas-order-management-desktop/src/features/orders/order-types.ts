export type DesktopOrderStatus = 'pending' | 'confirmed' | 'ready' | 'completed' | 'cancelled' | 'on_the_way' | 'pending_online_payment' | string;
export type DesktopPaymentStatus = 'paid' | 'pending' | 'refunded' | string;

export type DesktopOrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  subtotal: number;
  comment?: string | null;
  removed_ingredients?: string[] | null;
  addons?: Array<{ addon_item_name: string; addon_item_price: number }>;
};

export type DesktopOrder = {
  id: string;
  order_number: string | null;
  created_at: string;
  scheduled_pickup_at: string | null;
  order_status: DesktopOrderStatus;
  payment_status: DesktopPaymentStatus;
  payment_method: string | null;
  order_channel: string | null;
  order_type: string | null;
  customer_name: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  total: number;
  subtotal: number;
  tax: number;
  items: DesktopOrderItem[];
};
