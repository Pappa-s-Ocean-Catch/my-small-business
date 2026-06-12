-- Store order-level options separately from free-text kitchen notes.
-- Multiple values are comma-separated, for example: "Chicken salt,Extra salt".

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_options text;

WITH salt_options AS (
  SELECT ARRAY[
    'Chicken salt',
    'Salt',
    'Both Salt',
    'No salt at all',
    'Extra Salt',
    'Extra chicken salt'
  ] AS values
),
orders_with_lines AS (
  SELECT
    id,
    string_to_array(coalesce(special_instructions, ''), E'\n') AS lines
  FROM public.orders
  WHERE order_options IS NULL
    AND special_instructions IS NOT NULL
),
classified AS (
  SELECT
    owl.id,
    NULLIF(array_to_string(
      ARRAY(
        SELECT trim(line)
        FROM unnest(owl.lines) AS line
        CROSS JOIN salt_options
        WHERE trim(line) = ANY (salt_options.values)
      ),
      ','
    ), '') AS extracted_options,
    NULLIF(array_to_string(
      ARRAY(
        SELECT line
        FROM unnest(owl.lines) AS line
        CROSS JOIN salt_options
        WHERE trim(line) <> ALL (salt_options.values)
      ),
      E'\n'
    ), '') AS remaining_notes
  FROM orders_with_lines owl
)
UPDATE public.orders o
SET
  order_options = c.extracted_options,
  special_instructions = c.remaining_notes
FROM classified c
WHERE o.id = c.id
  AND c.extracted_options IS NOT NULL;

COMMENT ON COLUMN public.orders.order_options IS
  'Comma-separated order-level options such as salt choices. Kept separate from special_instructions.';
