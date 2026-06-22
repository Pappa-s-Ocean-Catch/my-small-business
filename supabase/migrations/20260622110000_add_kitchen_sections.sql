-- Add optional kitchen/print section support to products, add-ons, and order history.
-- Blank values remain null so existing items continue to default to the fried ticket in app logic.

ALTER TABLE public.sale_products
ADD COLUMN IF NOT EXISTS section TEXT;

ALTER TABLE public.addon_items
ADD COLUMN IF NOT EXISTS section TEXT;

ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS section TEXT;

ALTER TABLE public.order_item_addons
ADD COLUMN IF NOT EXISTS section TEXT;

COMMENT ON COLUMN public.sale_products.section IS 'Default kitchen print section for the product, e.g. Fried or Grill.';
COMMENT ON COLUMN public.addon_items.section IS 'Optional kitchen print section override contributed by this add-on item.';
COMMENT ON COLUMN public.order_items.section IS 'Resolved kitchen print section(s) stored for order history, comma-separated when an item prints in multiple sections.';
COMMENT ON COLUMN public.order_item_addons.section IS 'Kitchen print section metadata copied from the add-on item for order history.';
