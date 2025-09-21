-- Fix constraint to allow negative values for consumption movements
-- The current constraint prevents negative boxes_added and units_added,
-- but consumption movements need negative values to represent stock removal

-- Drop the existing constraint that prevents negative values
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_movements_boxes_non_negative'
    ) THEN
        ALTER TABLE public.inventory_movements 
        DROP CONSTRAINT inventory_movements_boxes_non_negative;
    END IF;
END $$;

-- Add a new constraint that allows negative values but prevents invalid combinations
-- This constraint ensures that:
-- 1. For received movements: boxes_added >= 0 AND units_added >= 0
-- 2. For consume movements: boxes_added <= 0 AND units_added <= 0  
-- 3. For adjustment movements: any values are allowed
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_movements_boxes_valid_consumption'
    ) THEN
        ALTER TABLE public.inventory_movements 
        ADD CONSTRAINT inventory_movements_boxes_valid_consumption 
        CHECK (
            -- For received movements, both should be non-negative
            (movement_type = 'received' AND boxes_added >= 0 AND units_added >= 0) OR
            -- For consume movements, both should be non-positive (negative or zero)
            (movement_type = 'consume' AND boxes_added <= 0 AND units_added <= 0) OR
            -- For adjustment movements, any values are allowed
            (movement_type = 'adjustment') OR
            -- For other movement types, allow any values
            (movement_type NOT IN ('received', 'consume', 'adjustment'))
        );
    END IF;
END $$;

-- Note: We removed the complex constraint with subquery as PostgreSQL doesn't support
-- subqueries in CHECK constraints. The application logic in update_inventory_with_boxes
-- function already handles validation of loose units against units_per_box.
