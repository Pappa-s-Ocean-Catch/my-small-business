-- Expand order_channel to support POS-created delivery orders that are paid online later.

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_order_channel_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_order_channel_check
CHECK (order_channel IN ('online', 'phone_pickup', 'phone_delivery', 'instore'));

COMMENT ON COLUMN public.orders.order_channel IS
  'Explicit order source channel: online, phone_pickup, phone_delivery, or instore.';
