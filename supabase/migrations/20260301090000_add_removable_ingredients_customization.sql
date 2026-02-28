-- Add removable ingredient customization support for menu items and orders

-- 1) Menu recipe ingredients: allow admin to mark ingredient as removable by customer
ALTER TABLE public.sale_product_ingredients
ADD COLUMN IF NOT EXISTS customer_can_remove BOOLEAN DEFAULT false;

-- Ensure existing rows are explicitly set and constrained
UPDATE public.sale_product_ingredients
SET customer_can_remove = false
WHERE customer_can_remove IS NULL;

ALTER TABLE public.sale_product_ingredients
ALTER COLUMN customer_can_remove SET NOT NULL;

COMMENT ON COLUMN public.sale_product_ingredients.customer_can_remove
IS 'If true, customers can remove this ingredient during item customization.';

-- 2) Cart items: persist removed ingredients selected by customer
ALTER TABLE public.cart_items
ADD COLUMN IF NOT EXISTS removed_ingredients TEXT[] DEFAULT '{}';

UPDATE public.cart_items
SET removed_ingredients = '{}'
WHERE removed_ingredients IS NULL;

ALTER TABLE public.cart_items
ALTER COLUMN removed_ingredients SET NOT NULL;

COMMENT ON COLUMN public.cart_items.removed_ingredients
IS 'Ingredient names removed by customer for this cart item.';

-- 3) Order items: persist removed ingredients for kitchen/admin/receipt output
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS removed_ingredients TEXT[] DEFAULT '{}';

UPDATE public.order_items
SET removed_ingredients = '{}'
WHERE removed_ingredients IS NULL;

ALTER TABLE public.order_items
ALTER COLUMN removed_ingredients SET NOT NULL;

COMMENT ON COLUMN public.order_items.removed_ingredients
IS 'Ingredient names removed by customer for this order item.';
