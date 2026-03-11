-- Add scheduled pickup time for pickup orders (pre-order and custom pickup time)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS scheduled_pickup_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.scheduled_pickup_at IS 'Customer-requested pickup date/time. Used for pre-orders (when store is closed) or optional custom pickup time when store is open.';
