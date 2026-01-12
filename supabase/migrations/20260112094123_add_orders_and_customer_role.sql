-- Add customer role and create orders system
-- This migration adds customer role support and creates the orders system

-- 1. Add 'customer' to roles table
DO $$ 
BEGIN
  -- Update the check constraint to include 'customer'
  ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_slug_check;
  ALTER TABLE public.roles ADD CONSTRAINT roles_slug_check 
    CHECK (slug IN ('admin', 'staff', 'customer'));
  
  -- Insert customer role if it doesn't exist
  INSERT INTO public.roles (slug) VALUES ('customer') 
  ON CONFLICT (slug) DO NOTHING;
END $$;

-- 2. Update profiles table to allow customer role
DO $$ 
BEGIN
  -- Drop existing foreign key constraint if it exists
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_slug_fkey;
  
  -- Re-add foreign key constraint (it will allow customer now)
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_slug_fkey 
    FOREIGN KEY (role_slug) REFERENCES public.roles(slug);
END $$;

-- 3. Add phone number to profiles (for customer contact info)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- 4. Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL, -- Human-readable order number (e.g., ORD-20260112-001)
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Null for anonymous orders
  customer_email TEXT NOT NULL, -- Required for contact
  customer_phone TEXT NOT NULL, -- Required for contact
  customer_name TEXT, -- Optional full name
  payment_method TEXT NOT NULL CHECK (payment_method IN ('online', 'store')), -- 'online' or 'store'
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  order_status TEXT NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  service_fee DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  special_instructions TEXT, -- General order-level instructions
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CHECK (subtotal >= 0),
  CHECK (tax >= 0),
  CHECK (delivery_fee >= 0),
  CHECK (service_fee >= 0),
  CHECK (total >= 0)
);

-- 5. Create order_items table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.sale_products(id) ON DELETE SET NULL, -- SET NULL to preserve order history if product is deleted
  product_name TEXT NOT NULL, -- Denormalized for historical reference
  product_description TEXT,
  product_image_url TEXT,
  base_price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal DECIMAL(10,2) NOT NULL, -- Calculated: (base_price + addon_prices) * quantity
  comment TEXT, -- Item-specific special instructions
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (quantity > 0),
  CHECK (base_price >= 0),
  CHECK (subtotal >= 0)
);

-- 6. Create order_item_addons table
CREATE TABLE IF NOT EXISTS public.order_item_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  addon_group_id UUID NOT NULL REFERENCES public.addon_groups(id) ON DELETE SET NULL, -- SET NULL to preserve order history
  addon_group_name TEXT NOT NULL, -- Denormalized for historical reference
  addon_item_id UUID NOT NULL REFERENCES public.addon_items(id) ON DELETE SET NULL, -- SET NULL to preserve order history
  addon_item_name TEXT NOT NULL, -- Denormalized for historical reference
  addon_item_price DECIMAL(10,2) NOT NULL, -- Denormalized for historical reference
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (addon_item_price >= 0)
);

-- 7. Create function to generate order numbers
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
DECLARE
  date_prefix TEXT;
  sequence_num INTEGER;
  new_order_number TEXT;
BEGIN
  -- Format: ORD-YYYYMMDD-XXX (e.g., ORD-20260112-001)
  date_prefix := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
  
  -- Get the next sequence number for today
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM LENGTH(date_prefix) + 1) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM public.orders
  WHERE order_number LIKE date_prefix || '%';
  
  -- Format with leading zeros (001, 002, etc.)
  new_order_number := date_prefix || LPAD(sequence_num::TEXT, 3, '0');
  
  RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger to auto-generate order number
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := public.generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_order_number ON public.orders;
CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_number();

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_item_addons_order_item_id ON public.order_item_addons(order_item_id);

-- 10. Add comments for documentation
COMMENT ON TABLE public.orders IS 'Customer orders from the online ordering system';
COMMENT ON TABLE public.order_items IS 'Individual items in an order';
COMMENT ON TABLE public.order_item_addons IS 'Selected add-ons for each order item';

COMMENT ON COLUMN public.orders.order_number IS 'Human-readable unique order identifier (e.g., ORD-20260112-001)';
COMMENT ON COLUMN public.orders.user_id IS 'User ID if customer is logged in, NULL for anonymous orders';
COMMENT ON COLUMN public.orders.customer_email IS 'Customer email address (required for contact)';
COMMENT ON COLUMN public.orders.customer_phone IS 'Customer phone number (required for contact)';
COMMENT ON COLUMN public.orders.payment_method IS 'Payment method: online (pay now) or store (pay at pickup)';
COMMENT ON COLUMN public.orders.payment_status IS 'Payment status: pending, paid, failed, refunded';
COMMENT ON COLUMN public.orders.order_status IS 'Order status: pending, confirmed, preparing, ready, completed, cancelled';

-- 11. Enable RLS on all tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_addons ENABLE ROW LEVEL SECURITY;

-- 12. RLS Policies for orders
-- Admins can read/write all orders
-- Customers can read their own orders
-- Public can insert orders (for anonymous checkout)

DROP POLICY IF EXISTS orders_admin_all ON public.orders;
DROP POLICY IF EXISTS orders_customer_read ON public.orders;
DROP POLICY IF EXISTS orders_public_insert ON public.orders;
DROP POLICY IF EXISTS orders_admin_update ON public.orders;

CREATE POLICY orders_admin_all ON public.orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role_slug = 'admin')
  );

CREATE POLICY orders_customer_read ON public.orders
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role_slug = 'admin')
  );

CREATE POLICY orders_public_insert ON public.orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY orders_admin_update ON public.orders
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role_slug = 'admin')
  );

-- 13. RLS Policies for order_items
DROP POLICY IF EXISTS order_items_admin_all ON public.order_items;
DROP POLICY IF EXISTS order_items_customer_read ON public.order_items;
DROP POLICY IF EXISTS order_items_public_insert ON public.order_items;

CREATE POLICY order_items_admin_all ON public.order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role_slug = 'admin')
  );

CREATE POLICY order_items_customer_read ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_items.order_id 
      AND (orders.user_id = auth.uid() OR 
           EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role_slug = 'admin'))
    )
  );

CREATE POLICY order_items_public_insert ON public.order_items
  FOR INSERT WITH CHECK (true);

-- 14. RLS Policies for order_item_addons
DROP POLICY IF EXISTS order_item_addons_admin_all ON public.order_item_addons;
DROP POLICY IF EXISTS order_item_addons_customer_read ON public.order_item_addons;
DROP POLICY IF EXISTS order_item_addons_public_insert ON public.order_item_addons;

CREATE POLICY order_item_addons_admin_all ON public.order_item_addons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role_slug = 'admin')
  );

CREATE POLICY order_item_addons_customer_read ON public.order_item_addons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_addons.order_item_id
      AND (o.user_id = auth.uid() OR 
           EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role_slug = 'admin'))
    )
  );

CREATE POLICY order_item_addons_public_insert ON public.order_item_addons
  FOR INSERT WITH CHECK (true);

-- 15. Add triggers to update updated_at timestamp
CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON public.orders 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
