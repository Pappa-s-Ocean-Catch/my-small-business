-- Add Sub-Categories Support to Sale Menu System
-- This migration enhances the existing sale_categories table to support sub-categories
-- and updates the sale_products table to reference sub-categories

-- Add unique constraint on name column first
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'sale_categories_name_unique'
    ) THEN
        ALTER TABLE public.sale_categories 
        ADD CONSTRAINT sale_categories_name_unique 
        UNIQUE (name);
    END IF;
END $$;

-- Add parent_category_id to sale_categories for hierarchical structure
ALTER TABLE public.sale_categories 
ADD COLUMN IF NOT EXISTS parent_category_id UUID REFERENCES public.sale_categories(id) ON DELETE CASCADE;

-- Add unique constraint on sale_products name column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'sale_products_name_unique'
    ) THEN
        ALTER TABLE public.sale_products 
        ADD CONSTRAINT sale_products_name_unique 
        UNIQUE (name);
    END IF;
END $$;

-- Add sub_category_id to sale_products to reference sub-categories
ALTER TABLE public.sale_products 
ADD COLUMN IF NOT EXISTS sub_category_id UUID REFERENCES public.sale_categories(id) ON DELETE SET NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sale_categories_parent ON public.sale_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_sale_products_sub_category ON public.sale_products(sub_category_id);

-- Add constraint to prevent circular references in category hierarchy
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'sale_categories_no_circular_reference'
    ) THEN
        ALTER TABLE public.sale_categories 
        ADD CONSTRAINT sale_categories_no_circular_reference 
        CHECK (id != parent_category_id);
    END IF;
END $$;

-- Note: We'll enforce sub-category validation through application logic
-- PostgreSQL CHECK constraints cannot contain subqueries
-- The constraint sale_products_sub_category_has_parent is removed

-- Create function to validate sub-category relationships
CREATE OR REPLACE FUNCTION public.validate_sub_category()
RETURNS TRIGGER AS $$
BEGIN
    -- If sub_category_id is provided, ensure it has a parent category
    IF NEW.sub_category_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.sale_categories 
            WHERE id = NEW.sub_category_id AND parent_category_id IS NOT NULL
        ) THEN
            RAISE EXCEPTION 'Sub-category must have a parent category';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate sub-category relationships
DROP TRIGGER IF EXISTS validate_sub_category_trigger ON public.sale_products;
CREATE TRIGGER validate_sub_category_trigger
    BEFORE INSERT OR UPDATE ON public.sale_products
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_sub_category();

-- Add comments for documentation
COMMENT ON COLUMN public.sale_categories.parent_category_id IS 'Reference to parent category for creating sub-categories hierarchy';
COMMENT ON COLUMN public.sale_products.sub_category_id IS 'Reference to sub-category within a main category';

-- Create function to get category hierarchy
CREATE OR REPLACE FUNCTION public.get_category_hierarchy(category_uuid UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    parent_category_id UUID,
    parent_name TEXT,
    level INTEGER,
    sort_order INTEGER,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE category_tree AS (
        -- Base case: root categories (no parent)
        SELECT 
            c.id,
            c.name,
            c.description,
            c.parent_category_id,
            NULL::TEXT as parent_name,
            0 as level,
            c.sort_order,
            c.is_active,
            c.created_at,
            c.updated_at
        FROM public.sale_categories c
        WHERE (category_uuid IS NULL OR c.id = category_uuid)
        AND c.parent_category_id IS NULL
        
        UNION ALL
        
        -- Recursive case: sub-categories
        SELECT 
            c.id,
            c.name,
            c.description,
            c.parent_category_id,
            ct.name as parent_name,
            ct.level + 1,
            c.sort_order,
            c.is_active,
            c.created_at,
            c.updated_at
        FROM public.sale_categories c
        INNER JOIN category_tree ct ON c.parent_category_id = ct.id
    )
    SELECT * FROM category_tree
    ORDER BY level, sort_order, name;
END;
$$ LANGUAGE plpgsql;

-- Create function to get products with category hierarchy
CREATE OR REPLACE FUNCTION public.get_products_with_hierarchy()
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    product_description TEXT,
    sale_price DECIMAL(10,2),
    image_url TEXT,
    is_active BOOLEAN,
    preparation_time_minutes INTEGER,
    main_category_id UUID,
    main_category_name TEXT,
    sub_category_id UUID,
    sub_category_name TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.id as product_id,
        sp.name as product_name,
        sp.description as product_description,
        sp.sale_price,
        sp.image_url,
        sp.is_active,
        sp.preparation_time_minutes,
        COALESCE(sc_parent.id, sc.id) as main_category_id,
        COALESCE(sc_parent.name, sc.name) as main_category_name,
        sp.sub_category_id,
        sc_sub.name as sub_category_name,
        sp.created_at,
        sp.updated_at
    FROM public.sale_products sp
    LEFT JOIN public.sale_categories sc ON sp.sale_category_id = sc.id
    LEFT JOIN public.sale_categories sc_sub ON sp.sub_category_id = sc_sub.id
    LEFT JOIN public.sale_categories sc_parent ON sc.parent_category_id = sc_parent.id
    ORDER BY 
        COALESCE(sc_parent.sort_order, sc.sort_order),
        sc_sub.sort_order,
        sp.name;
END;
$$ LANGUAGE plpgsql;

-- Update existing sample data to demonstrate the new structure
-- First, let's add some main categories
INSERT INTO public.sale_categories (name, description, sort_order) VALUES
('BEEF BURGERS', 'Delicious beef burgers with various toppings', 1),
('CHICKEN BURGERS', 'Tender chicken burgers and fillets', 2),
('FISH BURGERS', 'Fresh fish burgers and fillets', 3),
('VEGETARIAN BURGERS', 'Plant-based burger options', 4),
('STEAK SANDWICHES', 'Premium steak sandwiches', 5),
('SOUVLAKI', 'Traditional Greek wraps and souvlaki', 6),
('CHICKEN/LAMB SNACK PACK', 'Hearty snack packs with meat and chips', 7),
('PACKS', 'Combo packs and meal deals', 8),
('FISH', 'Fresh fish fillets and seafood', 9),
('CHIPS', 'Various chip sizes and types', 10),
('Chips And Gravy', 'Chips served with gravy', 11),
('SEAFOOD SIDES', 'Individual seafood items', 12),
('SIDES', 'Various side dishes and snacks', 13),
('SWEET', 'Desserts and sweet treats', 14),
('DRINKS', 'Beverages and drinks', 15),
('SAUCES', 'Condiments and sauces', 16),
('ALL DAY BREAKFAST', 'Breakfast items available all day', 17)
ON CONFLICT (name) DO NOTHING;

-- Add sub-categories for DRINKS
INSERT INTO public.sale_categories (name, description, parent_category_id, sort_order) 
SELECT 
    sub_cat.name,
    sub_cat.description,
    main_cat.id,
    sub_cat.sort_order
FROM (VALUES 
    ('Can', 'Canned beverages', 1),
    ('600ml Bottle', '600ml bottled drinks', 2),
    ('1.25l Bottle', '1.25 liter bottled drinks', 3),
    ('2l Bottle', '2 liter bottled drinks', 4),
    ('Water', 'Bottled water', 5),
    ('Powerade Ion4', 'Sports drinks', 6)
) AS sub_cat(name, description, sort_order)
CROSS JOIN public.sale_categories main_cat
WHERE main_cat.name = 'DRINKS'
ON CONFLICT (name) DO NOTHING;
