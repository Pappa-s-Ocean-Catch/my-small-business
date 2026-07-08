ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_driver_pin TEXT;

COMMENT ON COLUMN public.orders.delivery_driver_pin IS
  'Provider-supplied driver or pickup verification PIN for delivery handoff';
