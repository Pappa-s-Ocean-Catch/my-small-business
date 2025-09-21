-- Simplify the constraint to allow negative values for consumption
-- The previous constraint was too complex and might not be working correctly

-- Drop the complex constraint
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_movements_boxes_valid_consumption'
    ) THEN
        ALTER TABLE public.inventory_movements 
        DROP CONSTRAINT inventory_movements_boxes_valid_consumption;
    END IF;
END $$;

-- Add a simple constraint that just prevents invalid loose units
-- Allow any values for boxes_added and units_added (positive or negative)
-- But ensure loose units are reasonable (not negative and not too large)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_movements_basic_validation'
    ) THEN
        ALTER TABLE public.inventory_movements 
        ADD CONSTRAINT inventory_movements_basic_validation 
        CHECK (
            -- Basic validation: loose units should be non-negative and reasonable
            new_loose_units >= 0 AND 
            new_loose_units < 1000  -- Reasonable upper limit
        );
    END IF;
END $$;

-- Add a comment explaining the approach
COMMENT ON CONSTRAINT inventory_movements_basic_validation ON public.inventory_movements 
IS 'Basic validation for inventory movements. Allows negative values for consumption but prevents invalid loose units.';
