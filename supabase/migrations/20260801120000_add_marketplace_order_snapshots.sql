-- Expected: a third_party Uber Eats order with ID 123 can be inserted once.
-- Expected: a second Uber Eats order with ID 123 (including surrounding whitespace) is rejected.
-- Expected: a DoorDash order with ID 123 remains valid.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS marketplace_gross_sales DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS marketplace_gross_payout DECIMAL(10,2);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN ('pending', 'pending_online_payment', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled', 'refunded'));

CREATE UNIQUE INDEX IF NOT EXISTS orders_unique_marketplace_import
  ON public.orders (lower(delivery_partner_name), btrim(external_order_number))
  WHERE order_channel = 'third_party' AND external_order_number IS NOT NULL AND btrim(external_order_number) <> '';
