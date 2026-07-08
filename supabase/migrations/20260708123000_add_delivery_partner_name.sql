ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_partner_name TEXT;

COMMENT ON COLUMN public.orders.delivery_partner_name IS
  'Human-readable delivery partner selected from quote, such as Uber or DoorDash';
