ALTER TABLE public.sale_products
ADD COLUMN IF NOT EXISTS search_term TEXT;

COMMENT ON COLUMN public.sale_products.search_term IS
'Alternate searchable product names and aliases for POS/menu search, for example crab stick for seafood stick.';

UPDATE public.sale_products
SET search_term = 'crab stick, cran stick'
WHERE lower(name) = 'seafood stick'
  AND search_term IS NULL;
