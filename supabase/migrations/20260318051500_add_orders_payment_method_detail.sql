-- Add payment_method_detail to orders to capture tender type (e.g. 'cash', 'card', 'eftpos')

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_method_detail text;

COMMENT ON COLUMN public.orders.payment_method_detail IS
  'Optional free-text payment method detail for in-store payments (e.g. cash, card, eftpos).';

