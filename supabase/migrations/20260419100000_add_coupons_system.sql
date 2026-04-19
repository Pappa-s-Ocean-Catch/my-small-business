-- Coupons system
-- Handles manual code entry with usage limits and user targeting.

-- 1) Coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- Unique coupon code (e.g. SAVE10)
  title TEXT NOT NULL,
  description TEXT,

  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Discount definition
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,

  -- Optional active window
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,

  -- Usage limits
  max_uses INTEGER, -- Total times this coupon can be used (NULL = unlimited)
  usage_count INTEGER NOT NULL DEFAULT 0,
  max_uses_per_user INTEGER DEFAULT 1, -- NULL = unlimited

  -- Targeting
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Specifically for one user
  target_email TEXT, -- Specific email targeting

  -- Conditions
  min_cart_subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CHECK (discount_value >= 0),
  CHECK (usage_count >= 0),
  CHECK (max_uses IS NULL OR max_uses >= 0),
  CHECK (max_uses_per_user IS NULL OR max_uses_per_user >= 0),
  CHECK (min_cart_subtotal >= 0)
);

COMMENT ON TABLE public.coupons IS 'Coupon codes for manual entry with usage limits and targeting';

-- 2) Coupon Redemptions table (for tracking per-user/per-order usage)
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.coupon_redemptions IS 'Records of coupon usage per order and user';

-- 3) Orders: store applied coupon info
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.coupon_code IS 'The coupon code applied to this order';
COMMENT ON COLUMN public.orders.coupon_discount IS 'Discount amount from the applied coupon';

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON public.coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON public.coupon_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_order ON public.coupon_redemptions(order_id);

-- 5) RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Coupons policies: anyone can read active coupons (for validation), admin write
DROP POLICY IF EXISTS coupons_read_all ON public.coupons;
DROP POLICY IF EXISTS coupons_admin_all ON public.coupons;

CREATE POLICY coupons_read_all ON public.coupons FOR SELECT USING (true);
CREATE POLICY coupons_admin_all ON public.coupons FOR ALL USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);

-- Redemption policies: read own, admin read all, public insert
DROP POLICY IF EXISTS redemptions_read_own ON public.coupon_redemptions;
DROP POLICY IF EXISTS redemptions_admin_all ON public.coupon_redemptions;
DROP POLICY IF EXISTS redemptions_public_insert ON public.coupon_redemptions;

CREATE POLICY redemptions_read_own ON public.coupon_redemptions FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);

CREATE POLICY redemptions_admin_all ON public.coupon_redemptions FOR ALL USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);

CREATE POLICY redemptions_public_insert ON public.coupon_redemptions FOR INSERT WITH CHECK (true);
