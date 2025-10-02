-- Add unit_type column to products table
-- This migration adds a unit_type field to support different measurement units (item, kg, litre, piece)
-- for more flexible inventory management and alert systems

-- Add unit_type column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS unit_type TEXT NOT NULL DEFAULT 'item';

-- Add constraint to ensure unit_type is one of the allowed values
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_unit_type_valid'
    ) THEN
        ALTER TABLE public.products 
        ADD CONSTRAINT products_unit_type_valid 
        CHECK (unit_type IN ('item', 'kg', 'litre', 'piece'));
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.products.unit_type IS 'Unit type for the product: item, kg, litre, or piece. Used for inventory management and alerts.';

-- Update existing products to have 'item' as default unit_type (already set by DEFAULT)
-- This is just for documentation purposes
UPDATE public.products 
SET unit_type = 'item' 
WHERE unit_type IS NULL;
