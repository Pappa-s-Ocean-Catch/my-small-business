-- Add SEO-friendly slugs for public product URLs

-- 1) Column
ALTER TABLE public.sale_products
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2) Slugify helper
CREATE OR REPLACE FUNCTION public.slugify(input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    NULLIF(
      regexp_replace(
        regexp_replace(
          lower(coalesce(input, '')),
          '[^a-z0-9]+',
          '-',
          'g'
        ),
        '(^-+|-+$)',
        '',
        'g'
      ),
      ''
    );
$$;

-- 3) Trigger to keep slug set + unique
CREATE OR REPLACE FUNCTION public.set_sale_product_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
BEGIN
  -- Ensure we have an id available for uniqueness suffix if needed
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  -- Prefer explicit slug, otherwise derive from name
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    base_slug := public.slugify(NEW.name);
  ELSE
    base_slug := public.slugify(NEW.slug);
  END IF;

  IF base_slug IS NULL THEN
    base_slug := 'item';
  END IF;

  candidate := base_slug;

  -- If another row already uses this slug, suffix with a stable id prefix
  IF EXISTS (
    SELECT 1
    FROM public.sale_products sp
    WHERE sp.slug = candidate
      AND sp.id <> NEW.id
  ) THEN
    candidate := candidate || '-' || substr(NEW.id::text, 1, 8);
  END IF;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_products_set_slug ON public.sale_products;
CREATE TRIGGER trg_sale_products_set_slug
BEFORE INSERT OR UPDATE OF name, slug
ON public.sale_products
FOR EACH ROW
EXECUTE FUNCTION public.set_sale_product_slug();

-- 4) Backfill existing rows (fires trigger)
UPDATE public.sale_products
SET slug = NULL
WHERE slug IS NULL OR btrim(slug) = '';

-- 5) Index for fast lookup + uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS sale_products_slug_unique
ON public.sale_products (slug)
WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS sale_products_slug_idx
ON public.sale_products (slug);
