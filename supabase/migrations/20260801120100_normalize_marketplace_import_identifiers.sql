DROP INDEX IF EXISTS public.orders_unique_marketplace_import;

CREATE UNIQUE INDEX orders_unique_marketplace_import
  ON public.orders (lower(delivery_partner_name), btrim(external_order_number))
  WHERE order_channel = 'third_party' AND external_order_number IS NOT NULL AND btrim(external_order_number) <> '';
