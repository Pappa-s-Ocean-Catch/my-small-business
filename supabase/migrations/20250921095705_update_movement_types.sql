-- Update movement type constraint to allow new types
-- This migration updates the inventory_movements table to support the new movement types

-- First, drop the existing constraint
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_movements_movement_type_check'
    ) THEN
        ALTER TABLE public.inventory_movements 
        DROP CONSTRAINT inventory_movements_movement_type_check;
    END IF;
END $$;

-- Add the new constraint with updated movement types
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_movements_movement_type_check'
    ) THEN
        ALTER TABLE public.inventory_movements 
        ADD CONSTRAINT inventory_movements_movement_type_check 
        CHECK (movement_type IN ('purchase', 'consumption', 'adjustment', 'return', 'transfer', 'received', 'consume'));
    END IF;
END $$;

-- Update any existing 'purchase' records to 'received' for consistency
UPDATE public.inventory_movements 
SET movement_type = 'received' 
WHERE movement_type = 'purchase';

-- Update any existing 'consumption' records to 'consume' for consistency  
UPDATE public.inventory_movements 
SET movement_type = 'consume' 
WHERE movement_type = 'consumption';

-- Now we can drop the old constraint and add the new one with only the new types
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_movements_movement_type_check'
    ) THEN
        ALTER TABLE public.inventory_movements 
        DROP CONSTRAINT inventory_movements_movement_type_check;
    END IF;
END $$;

-- Add the final constraint with only the new movement types
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_movements_movement_type_check'
    ) THEN
        ALTER TABLE public.inventory_movements 
        ADD CONSTRAINT inventory_movements_movement_type_check 
        CHECK (movement_type IN ('received', 'consume', 'adjustment', 'return', 'transfer'));
    END IF;
END $$;
