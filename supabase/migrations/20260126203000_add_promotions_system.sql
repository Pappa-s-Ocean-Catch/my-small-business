-- Promotions system
-- Supports product-level and cart-level promotions with optional date and hour windows.

-- 1) Promotions table
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,

  is_active BOOLEAN NOT NULL DEFAULT true,
  applies_to TEXT NOT NULL CHECK (applies_to IN ('product', 'cart')),

  -- Discount definition
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Optional active window
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,

  -- Optional weekly/day-time windows (store-local minutes)
  days_of_week SMALLINT[], -- 0=Sun..6=Sat
  daily_start_minute SMALLINT,
  daily_end_minute SMALLINT,

  -- Targeting
  product_scope TEXT NOT NULL DEFAULT 'all' CHECK (product_scope IN ('all', 'specific', 'min_price')),
  min_product_price DECIMAL(10,2),

  cart_scope TEXT NOT NULL DEFAULT 'all' CHECK (cart_scope IN ('all', 'subtotal_min')),
  min_cart_subtotal DECIMAL(10,2),

  -- Display
  show_on_home BOOLEAN NOT NULL DEFAULT false,
  home_title TEXT,

  priority INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CHECK (discount_value >= 0),
  CHECK (min_product_price IS NULL OR min_product_price >= 0),
  CHECK (min_cart_subtotal IS NULL OR min_cart_subtotal >= 0)
);

COMMENT ON TABLE public.promotions IS 'Promotions for ordering system (product or cart) with time windows and targeting rules';
COMMENT ON COLUMN public.promotions.days_of_week IS 'Optional days of week when promo applies (0=Sun..6=Sat)';
COMMENT ON COLUMN public.promotions.daily_start_minute IS 'Optional start minute in store timezone (0-1439)';
COMMENT ON COLUMN public.promotions.daily_end_minute IS 'Optional end minute in store timezone (0-1439)';

-- 2) Promotion -> products mapping (for specific product promos)
CREATE TABLE IF NOT EXISTS public.promotion_products (
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  sale_product_id UUID NOT NULL REFERENCES public.sale_products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (promotion_id, sale_product_id)
);

COMMENT ON TABLE public.promotion_products IS 'Join table for promotions targeting specific sale products';

-- 3) Orders: store applied promotions summary + discount
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promotion_discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promotions_applied JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.orders.promotion_discount IS 'Total discount from promotions applied to this order (excludes delivery fee)';
COMMENT ON COLUMN public.orders.promotions_applied IS 'JSON array describing applied promotions (ids/titles/amounts)';

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_applies_to ON public.promotions(applies_to);
CREATE INDEX IF NOT EXISTS idx_promotions_show_on_home ON public.promotions(show_on_home) WHERE show_on_home = true;
CREATE INDEX IF NOT EXISTS idx_promotion_products_product ON public.promotion_products(sale_product_id);

-- 5) RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_products ENABLE ROW LEVEL SECURITY;

-- Policies: read all, admin write
DROP POLICY IF EXISTS promotions_read_all ON public.promotions;
DROP POLICY IF EXISTS promotions_admin_ins ON public.promotions;
DROP POLICY IF EXISTS promotions_admin_upd ON public.promotions;
DROP POLICY IF EXISTS promotions_admin_del ON public.promotions;

CREATE POLICY promotions_read_all ON public.promotions FOR SELECT USING (true);
CREATE POLICY promotions_admin_ins ON public.promotions FOR INSERT WITH CHECK (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
CREATE POLICY promotions_admin_upd ON public.promotions FOR UPDATE USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
CREATE POLICY promotions_admin_del ON public.promotions FOR DELETE USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);

DROP POLICY IF EXISTS promotion_products_read_all ON public.promotion_products;
DROP POLICY IF EXISTS promotion_products_admin_ins ON public.promotion_products;
DROP POLICY IF EXISTS promotion_products_admin_upd ON public.promotion_products;
DROP POLICY IF EXISTS promotion_products_admin_del ON public.promotion_products;

CREATE POLICY promotion_products_read_all ON public.promotion_products FOR SELECT USING (true);
CREATE POLICY promotion_products_admin_ins ON public.promotion_products FOR INSERT WITH CHECK (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
CREATE POLICY promotion_products_admin_upd ON public.promotion_products FOR UPDATE USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
CREATE POLICY promotion_products_admin_del ON public.promotion_products FOR DELETE USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
