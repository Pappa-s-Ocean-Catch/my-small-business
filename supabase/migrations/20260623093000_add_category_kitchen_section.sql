-- Add optional kitchen/print section support to sale categories so groups can
-- provide a default before product-level setup is needed.
ALTER TABLE public.sale_categories
ADD COLUMN IF NOT EXISTS section TEXT;

COMMENT ON COLUMN public.sale_categories.section IS 'Optional default kitchen print section for this menu group/category. Used when add-ons and products do not define a section.';
