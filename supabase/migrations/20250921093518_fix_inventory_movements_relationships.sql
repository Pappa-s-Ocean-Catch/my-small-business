-- Fix foreign key relationships for inventory_movements table

-- First, check if the created_by column exists and add it if it doesn't
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.inventory_movements 
        ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_movements_created_by_fkey'
    ) THEN
        ALTER TABLE public.inventory_movements 
        ADD CONSTRAINT inventory_movements_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES auth.users(id);
    END IF;
END $$;

-- Update RLS policies to allow access to profiles through the relationship
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view inventory movements" ON public.inventory_movements;
    DROP POLICY IF EXISTS "Users can insert inventory movements" ON public.inventory_movements;
    DROP POLICY IF EXISTS "Users can update inventory movements" ON public.inventory_movements;
    
    -- Create new policies
    CREATE POLICY "Users can view inventory movements" ON public.inventory_movements
        FOR SELECT USING (true);
    
    CREATE POLICY "Users can insert inventory movements" ON public.inventory_movements
        FOR INSERT WITH CHECK (true);
    
    CREATE POLICY "Users can update inventory movements" ON public.inventory_movements
        FOR UPDATE USING (true);
END $$;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.inventory_movements TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
