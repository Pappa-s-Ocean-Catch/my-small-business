WITH ranked_marketplace_imports AS (
  SELECT
    id,
    external_order_number,
    ROW_NUMBER() OVER (
      PARTITION BY lower(delivery_partner_name), btrim(external_order_number)
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS duplicate_rank
  FROM public.orders
  WHERE order_channel = 'third_party'
    AND delivery_partner_name IS NOT NULL
    AND external_order_number IS NOT NULL
    AND btrim(external_order_number) <> ''
)
UPDATE public.orders AS orders
SET
  external_order_number = NULL,
  special_instructions = CASE
    WHEN POSITION(
      format('[Marketplace duplicate import identifier cleared: %s]', ranked.external_order_number)
      IN COALESCE(orders.special_instructions, '')
    ) > 0 THEN orders.special_instructions
    ELSE CONCAT_WS(
      E'\n',
      NULLIF(orders.special_instructions, ''),
      format('[Marketplace duplicate import identifier cleared: %s]', ranked.external_order_number)
    )
  END
FROM ranked_marketplace_imports AS ranked
WHERE orders.id = ranked.id
  AND ranked.duplicate_rank > 1;

DROP INDEX IF EXISTS public.orders_unique_marketplace_import;

CREATE UNIQUE INDEX orders_unique_marketplace_import
  ON public.orders (lower(delivery_partner_name), btrim(external_order_number))
  WHERE order_channel = 'third_party' AND external_order_number IS NOT NULL AND btrim(external_order_number) <> '';
