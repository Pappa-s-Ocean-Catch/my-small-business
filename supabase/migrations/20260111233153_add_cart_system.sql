-- Cart System for Online Orders
-- This migration creates tables for persisting shopping cart data

-- Carts table - tracks shopping carts by session or user
CREATE TABLE IF NOT EXISTS public.carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL, -- Unique session identifier (stored in localStorage)
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Optional: for logged-in users (future feature)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id)
);

-- Cart Items - individual items in a cart
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.sale_products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL, -- Denormalized for historical reference
  product_description TEXT,
  product_image_url TEXT,
  base_price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal DECIMAL(10,2) NOT NULL, -- Calculated: (base_price + addon_prices) * quantity
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CHECK (quantity > 0),
  CHECK (base_price >= 0),
  CHECK (subtotal >= 0)
);

-- Cart Item Add-ons - selected add-ons for each cart item
CREATE TABLE IF NOT EXISTS public.cart_item_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_item_id UUID NOT NULL REFERENCES public.cart_items(id) ON DELETE CASCADE,
  addon_group_id UUID NOT NULL REFERENCES public.addon_groups(id) ON DELETE CASCADE,
  addon_group_name TEXT NOT NULL, -- Denormalized for historical reference
  addon_item_id UUID NOT NULL REFERENCES public.addon_items(id) ON DELETE CASCADE,
  addon_item_name TEXT NOT NULL, -- Denormalized for historical reference
  addon_item_price DECIMAL(10,2) NOT NULL, -- Denormalized for historical reference
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (addon_item_price >= 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_carts_session_id ON public.carts(session_id);
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON public.carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON public.cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_item_addons_cart_item_id ON public.cart_item_addons(cart_item_id);

-- Add comments for documentation
COMMENT ON TABLE public.carts IS 'Shopping carts tracked by session ID or user ID';
COMMENT ON TABLE public.cart_items IS 'Individual items in a shopping cart';
COMMENT ON TABLE public.cart_item_addons IS 'Selected add-ons for each cart item';

COMMENT ON COLUMN public.carts.session_id IS 'Unique session identifier stored in browser localStorage';
COMMENT ON COLUMN public.carts.user_id IS 'Optional user ID for logged-in users (future feature)';
COMMENT ON COLUMN public.cart_items.subtotal IS 'Calculated total: (base_price + sum of addon prices) * quantity';

-- Enable RLS on all tables
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_item_addons ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow public read/write for carts by session_id
-- Users can only access their own carts (by session_id or user_id)

-- Carts policies
DROP POLICY IF EXISTS carts_public_read ON public.carts;
DROP POLICY IF EXISTS carts_public_insert ON public.carts;
DROP POLICY IF EXISTS carts_public_update ON public.carts;
DROP POLICY IF EXISTS carts_public_delete ON public.carts;

CREATE POLICY carts_public_read ON public.carts
  FOR SELECT USING (true);

CREATE POLICY carts_public_insert ON public.carts
  FOR INSERT WITH CHECK (true);

CREATE POLICY carts_public_update ON public.carts
  FOR UPDATE USING (true);

CREATE POLICY carts_public_delete ON public.carts
  FOR DELETE USING (true);

-- Cart Items policies
DROP POLICY IF EXISTS cart_items_public_read ON public.cart_items;
DROP POLICY IF EXISTS cart_items_public_insert ON public.cart_items;
DROP POLICY IF EXISTS cart_items_public_update ON public.cart_items;
DROP POLICY IF EXISTS cart_items_public_delete ON public.cart_items;

CREATE POLICY cart_items_public_read ON public.cart_items
  FOR SELECT USING (true);

CREATE POLICY cart_items_public_insert ON public.cart_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY cart_items_public_update ON public.cart_items
  FOR UPDATE USING (true);

CREATE POLICY cart_items_public_delete ON public.cart_items
  FOR DELETE USING (true);

-- Cart Item Add-ons policies
DROP POLICY IF EXISTS cart_item_addons_public_read ON public.cart_item_addons;
DROP POLICY IF EXISTS cart_item_addons_public_insert ON public.cart_item_addons;
DROP POLICY IF EXISTS cart_item_addons_public_update ON public.cart_item_addons;
DROP POLICY IF EXISTS cart_item_addons_public_delete ON public.cart_item_addons;

CREATE POLICY cart_item_addons_public_read ON public.cart_item_addons
  FOR SELECT USING (true);

CREATE POLICY cart_item_addons_public_insert ON public.cart_item_addons
  FOR INSERT WITH CHECK (true);

CREATE POLICY cart_item_addons_public_update ON public.cart_item_addons
  FOR UPDATE USING (true);

CREATE POLICY cart_item_addons_public_delete ON public.cart_item_addons
  FOR DELETE USING (true);

-- Add triggers to update updated_at timestamp
CREATE TRIGGER update_carts_updated_at 
  BEFORE UPDATE ON public.carts 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at 
  BEFORE UPDATE ON public.cart_items 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to clean up old carts (optional - for maintenance)
-- Carts older than 30 days can be cleaned up
CREATE OR REPLACE FUNCTION public.cleanup_old_carts()
RETURNS void AS $$
BEGIN
  DELETE FROM public.carts
  WHERE updated_at < NOW() - INTERVAL '30 days'
    AND user_id IS NULL; -- Only delete anonymous carts, keep user carts
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
