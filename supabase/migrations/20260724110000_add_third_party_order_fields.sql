-- Support POS-entered third-party marketplace orders.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS external_order_number TEXT;

COMMENT ON COLUMN public.orders.external_order_number IS
  'External marketplace order identifier entered by staff (e.g. Uber Eats or DoorDash order ID)';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_channel_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_channel_check
  CHECK (order_channel IN ('online', 'phone_pickup', 'phone_delivery', 'instore', 'third_party'));

COMMENT ON COLUMN public.orders.order_channel IS
  'Order channel: online, phone_pickup, phone_delivery, instore, or third_party';
