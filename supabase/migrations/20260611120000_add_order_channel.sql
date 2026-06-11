-- Add explicit order channel for reporting and app behavior.
-- Values:
-- - online: website/customer web checkout
-- - phone_pickup: POS order for a customer pickup, usually from phone order
-- - instore: POS walk-in/counter order

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_channel text;

UPDATE public.orders
SET order_channel = CASE
  WHEN payment_method = 'online' THEN 'online'
  WHEN upper(coalesce(customer_name, '')) = 'INSTORE' THEN 'instore'
  ELSE 'phone_pickup'
END
WHERE order_channel IS NULL;

ALTER TABLE public.orders
ALTER COLUMN order_channel SET DEFAULT 'online';

ALTER TABLE public.orders
ALTER COLUMN order_channel SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_order_channel_check'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
    ADD CONSTRAINT orders_order_channel_check
    CHECK (order_channel IN ('online', 'phone_pickup', 'instore'));
  END IF;
END $$;

COMMENT ON COLUMN public.orders.order_channel IS
  'Explicit order source channel: online, phone_pickup, or instore.';
