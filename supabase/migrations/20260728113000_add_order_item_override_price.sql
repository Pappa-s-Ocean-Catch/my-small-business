ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS override_price DECIMAL(10,2);

COMMENT ON COLUMN public.order_items.override_price IS
  'Optional marketplace line total override used when an imported 3rd-party item price differs from the POS catalog price.';
