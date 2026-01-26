-- Add SEO metadata fields for public product pages

ALTER TABLE public.sale_products
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS seo_text TEXT;

-- Optional helper index (not strictly required, but nice for admin searching)
CREATE INDEX IF NOT EXISTS sale_products_seo_title_idx
  ON public.sale_products (seo_title);
