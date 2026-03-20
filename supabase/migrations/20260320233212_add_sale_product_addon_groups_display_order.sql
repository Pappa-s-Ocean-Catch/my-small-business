-- Add per-product display order for sale_product_addon_groups

ALTER TABLE public.sale_product_addon_groups
ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

-- Helps receipts/load paths order by display_order efficiently.
CREATE INDEX IF NOT EXISTS idx_sale_product_addon_groups_sale_product_id_display_order
ON public.sale_product_addon_groups(sale_product_id, display_order);

