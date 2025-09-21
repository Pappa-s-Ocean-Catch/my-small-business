-- Sale Product System
-- This migration creates tables for sale products (menu items) that are assembled from inventory products

-- Sale Categories (Menu Categories) - separate from inventory categories
CREATE TABLE IF NOT EXISTS public.sale_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sale Products (Final assembled products for sale)
CREATE TABLE IF NOT EXISTS public.sale_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sale_price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  sale_category_id UUID REFERENCES public.sale_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  preparation_time_minutes INTEGER DEFAULT 0, -- Optional: prep time
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sale Product Ingredients (what inventory products make up each sale product)
CREATE TABLE IF NOT EXISTS public.sale_product_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_product_id UUID REFERENCES public.sale_products(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  quantity_required DECIMAL(10,3) NOT NULL, -- Can be fractional (e.g., 0.5 cups)
  unit_of_measure TEXT DEFAULT 'units', -- e.g., 'units', 'cups', 'grams', 'ml'
  is_optional BOOLEAN DEFAULT false, -- Optional ingredients
  notes TEXT, -- e.g., "garnish", "to taste"
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add constraints (using DO blocks to handle IF NOT EXISTS)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'sale_products_price_positive'
    ) THEN
        ALTER TABLE public.sale_products 
        ADD CONSTRAINT sale_products_price_positive 
        CHECK (sale_price >= 0);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'sale_products_prep_time_non_negative'
    ) THEN
        ALTER TABLE public.sale_products 
        ADD CONSTRAINT sale_products_prep_time_non_negative 
        CHECK (preparation_time_minutes >= 0);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'sale_product_ingredients_quantity_positive'
    ) THEN
        ALTER TABLE public.sale_product_ingredients 
        ADD CONSTRAINT sale_product_ingredients_quantity_positive 
        CHECK (quantity_required > 0);
    END IF;
END $$;

-- Add unique constraint to prevent duplicate ingredients in same sale product
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'sale_product_ingredients_unique'
    ) THEN
        ALTER TABLE public.sale_product_ingredients 
        ADD CONSTRAINT sale_product_ingredients_unique 
        UNIQUE (sale_product_id, product_id);
    END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sale_products_category ON public.sale_products(sale_category_id);
CREATE INDEX IF NOT EXISTS idx_sale_products_active ON public.sale_products(is_active);
CREATE INDEX IF NOT EXISTS idx_sale_product_ingredients_sale_product ON public.sale_product_ingredients(sale_product_id);
CREATE INDEX IF NOT EXISTS idx_sale_product_ingredients_product ON public.sale_product_ingredients(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_categories_sort_order ON public.sale_categories(sort_order);

-- Add comments for documentation
COMMENT ON TABLE public.sale_categories IS 'Menu categories for organizing sale products (separate from inventory categories)';
COMMENT ON TABLE public.sale_products IS 'Final products assembled from inventory items for sale to customers';
COMMENT ON TABLE public.sale_product_ingredients IS 'Ingredients (inventory products) required to make each sale product';

COMMENT ON COLUMN public.sale_products.preparation_time_minutes IS 'Estimated time to prepare this sale product in minutes';
COMMENT ON COLUMN public.sale_product_ingredients.quantity_required IS 'Amount of inventory product needed (can be fractional)';
COMMENT ON COLUMN public.sale_product_ingredients.unit_of_measure IS 'Unit of measurement (units, cups, grams, ml, etc.)';
COMMENT ON COLUMN public.sale_product_ingredients.is_optional IS 'Whether this ingredient is optional and can be omitted';
COMMENT ON COLUMN public.sale_product_ingredients.notes IS 'Special instructions or notes for this ingredient';

-- Enable RLS on all new tables
ALTER TABLE public.sale_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_product_ingredients ENABLE ROW LEVEL SECURITY;

-- Sale Categories policies: read all, admin write
DROP POLICY IF EXISTS sale_categories_read_all ON public.sale_categories;
DROP POLICY IF EXISTS sale_categories_admin_ins ON public.sale_categories;
DROP POLICY IF EXISTS sale_categories_admin_upd ON public.sale_categories;
DROP POLICY IF EXISTS sale_categories_admin_del ON public.sale_categories;

CREATE POLICY sale_categories_read_all ON public.sale_categories FOR SELECT USING (true);
CREATE POLICY sale_categories_admin_ins ON public.sale_categories FOR INSERT WITH CHECK (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
CREATE POLICY sale_categories_admin_upd ON public.sale_categories FOR UPDATE USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
CREATE POLICY sale_categories_admin_del ON public.sale_categories FOR DELETE USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);

-- Sale Products policies: read all, admin write
DROP POLICY IF EXISTS sale_products_read_all ON public.sale_products;
DROP POLICY IF EXISTS sale_products_admin_ins ON public.sale_products;
DROP POLICY IF EXISTS sale_products_admin_upd ON public.sale_products;
DROP POLICY IF EXISTS sale_products_admin_del ON public.sale_products;

CREATE POLICY sale_products_read_all ON public.sale_products FOR SELECT USING (true);
CREATE POLICY sale_products_admin_ins ON public.sale_products FOR INSERT WITH CHECK (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
CREATE POLICY sale_products_admin_upd ON public.sale_products FOR UPDATE USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
CREATE POLICY sale_products_admin_del ON public.sale_products FOR DELETE USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);

-- Sale Product Ingredients policies: read all, admin write
DROP POLICY IF EXISTS sale_product_ingredients_read_all ON public.sale_product_ingredients;
DROP POLICY IF EXISTS sale_product_ingredients_admin_ins ON public.sale_product_ingredients;
DROP POLICY IF EXISTS sale_product_ingredients_admin_upd ON public.sale_product_ingredients;
DROP POLICY IF EXISTS sale_product_ingredients_admin_del ON public.sale_product_ingredients;

CREATE POLICY sale_product_ingredients_read_all ON public.sale_product_ingredients FOR SELECT USING (true);
CREATE POLICY sale_product_ingredients_admin_ins ON public.sale_product_ingredients FOR INSERT WITH CHECK (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
CREATE POLICY sale_product_ingredients_admin_upd ON public.sale_product_ingredients FOR UPDATE USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
CREATE POLICY sale_product_ingredients_admin_del ON public.sale_product_ingredients FOR DELETE USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);

-- Business Logic Functions

-- Calculate total cost of ingredients for a sale product
CREATE OR REPLACE FUNCTION public.calculate_sale_product_cost(sale_product_uuid UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  total_cost DECIMAL(10,2) := 0;
BEGIN
  SELECT COALESCE(SUM(spi.quantity_required * p.purchase_price), 0)
  INTO total_cost
  FROM public.sale_product_ingredients spi
  JOIN public.products p ON spi.product_id = p.id
  WHERE spi.sale_product_id = sale_product_uuid;
  
  RETURN total_cost;
END;
$$ LANGUAGE plpgsql;

-- Check if we have enough inventory to make a sale product
CREATE OR REPLACE FUNCTION public.check_sale_product_availability(
  sale_product_uuid UUID,
  quantity_needed INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  ingredient RECORD;
  available BOOLEAN := true;
BEGIN
  FOR ingredient IN 
    SELECT spi.product_id, spi.quantity_required * quantity_needed as total_needed
    FROM public.sale_product_ingredients spi
    WHERE spi.sale_product_id = sale_product_uuid
  LOOP
    IF (SELECT total_units FROM public.products WHERE id = ingredient.product_id) < ingredient.total_needed THEN
      available := false;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN available;
END;
$$ LANGUAGE plpgsql;

-- Get sale product with cost and availability information
CREATE OR REPLACE FUNCTION public.get_sale_product_details(sale_product_uuid UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  sale_price DECIMAL(10,2),
  image_url TEXT,
  sale_category_id UUID,
  is_active BOOLEAN,
  preparation_time_minutes INTEGER,
  cost_of_goods DECIMAL(10,2),
  profit_margin DECIMAL(10,2),
  is_available BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id,
    sp.name,
    sp.description,
    sp.sale_price,
    sp.image_url,
    sp.sale_category_id,
    sp.is_active,
    sp.preparation_time_minutes,
    public.calculate_sale_product_cost(sp.id) as cost_of_goods,
    sp.sale_price - public.calculate_sale_product_cost(sp.id) as profit_margin,
    public.check_sale_product_availability(sp.id) as is_available,
    sp.created_at,
    sp.updated_at
  FROM public.sale_products sp
  WHERE sp.id = sale_product_uuid;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data
INSERT INTO public.sale_categories (name, description, sort_order) VALUES
('Beverages', 'Hot and cold drinks', 1),
('Food', 'Meals and snacks', 2),
('Desserts', 'Sweet treats', 3)
ON CONFLICT DO NOTHING;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sale_categories_updated_at 
  BEFORE UPDATE ON public.sale_categories 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sale_products_updated_at 
  BEFORE UPDATE ON public.sale_products 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
