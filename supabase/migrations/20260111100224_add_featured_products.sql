-- Add is_featured column to sale_products table
-- This allows marking specific products to be displayed on the home page

ALTER TABLE public.sale_products 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Create index for faster queries on featured products
CREATE INDEX IF NOT EXISTS idx_sale_products_is_featured 
ON public.sale_products(is_featured) 
WHERE is_featured = true;

-- Add comment
COMMENT ON COLUMN public.sale_products.is_featured IS 'Whether this product should be featured on the home page';
