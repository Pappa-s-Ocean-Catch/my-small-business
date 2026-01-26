-- Sale Product Includes / Bundles
-- Supports compound products (packs) that include other sale products.

CREATE TABLE IF NOT EXISTS public.sale_product_includes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_sale_product_id UUID NOT NULL REFERENCES public.sale_products(id) ON DELETE CASCADE,
  included_sale_product_id UUID NOT NULL REFERENCES public.sale_products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sale_product_includes_quantity_positive'
  ) THEN
    ALTER TABLE public.sale_product_includes
    ADD CONSTRAINT sale_product_includes_quantity_positive
    CHECK (quantity > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sale_product_includes_not_self'
  ) THEN
    ALTER TABLE public.sale_product_includes
    ADD CONSTRAINT sale_product_includes_not_self
    CHECK (parent_sale_product_id <> included_sale_product_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sale_product_includes_unique'
  ) THEN
    ALTER TABLE public.sale_product_includes
    ADD CONSTRAINT sale_product_includes_unique
    UNIQUE (parent_sale_product_id, included_sale_product_id);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sale_product_includes_parent
ON public.sale_product_includes(parent_sale_product_id);

CREATE INDEX IF NOT EXISTS idx_sale_product_includes_included
ON public.sale_product_includes(included_sale_product_id);

COMMENT ON TABLE public.sale_product_includes IS 'Bundle/pack composition for sale products (a parent sale product can include many sale products)';

-- RLS
ALTER TABLE public.sale_product_includes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sale_product_includes_read_all ON public.sale_product_includes;
DROP POLICY IF EXISTS sale_product_includes_admin_ins ON public.sale_product_includes;
DROP POLICY IF EXISTS sale_product_includes_admin_upd ON public.sale_product_includes;
DROP POLICY IF EXISTS sale_product_includes_admin_del ON public.sale_product_includes;

CREATE POLICY sale_product_includes_read_all ON public.sale_product_includes
FOR SELECT USING (true);

CREATE POLICY sale_product_includes_admin_ins ON public.sale_product_includes
FOR INSERT WITH CHECK (
  EXISTS(
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role_slug = 'admin'
  )
);

CREATE POLICY sale_product_includes_admin_upd ON public.sale_product_includes
FOR UPDATE USING (
  EXISTS(
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role_slug = 'admin'
  )
);

CREATE POLICY sale_product_includes_admin_del ON public.sale_product_includes
FOR DELETE USING (
  EXISTS(
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role_slug = 'admin'
  )
);
