-- Add sort_order to sale_products
-- Enables deterministic ordering of menu items within a category/sub-category.

ALTER TABLE public.sale_products
ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Backfill: within each (sale_category_id, sub_category_id) group, order by name.
-- This gives a stable initial ordering without manual work.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sale_products'
      AND column_name = 'sort_order'
  ) THEN
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY sale_category_id, sub_category_id
          ORDER BY name
        ) - 1 AS new_sort
      FROM public.sale_products
    )
    UPDATE public.sale_products sp
    SET sort_order = ranked.new_sort
    FROM ranked
    WHERE sp.id = ranked.id;
  END IF;
END $$;

-- Helpful indexes for ordering queries
CREATE INDEX IF NOT EXISTS idx_sale_products_category_sort_order
  ON public.sale_products (sale_category_id, sort_order, name);

CREATE INDEX IF NOT EXISTS idx_sale_products_sub_category_sort_order
  ON public.sale_products (sub_category_id, sort_order, name);

COMMENT ON COLUMN public.sale_products.sort_order IS 'Display order within (sale_category_id, sub_category_id) groups';
