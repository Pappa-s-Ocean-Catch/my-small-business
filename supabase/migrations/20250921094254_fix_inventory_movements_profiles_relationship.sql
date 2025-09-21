-- Fix inventory_movements foreign key relationship to reference public.profiles instead of auth.users

-- First, drop the existing foreign key constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_movements_created_by_fkey'
    ) THEN
        ALTER TABLE public.inventory_movements 
        DROP CONSTRAINT inventory_movements_created_by_fkey;
    END IF;
END $$;

-- Update the created_by column to reference public.profiles(id) instead of auth.users(id)
DO $$ 
BEGIN
    -- Check if the column exists and update its foreign key reference
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventory_movements' 
        AND column_name = 'created_by'
    ) THEN
        -- Add the correct foreign key constraint
        ALTER TABLE public.inventory_movements 
        ADD CONSTRAINT inventory_movements_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES public.profiles(id);
    ELSE
        -- If column doesn't exist, create it with the correct reference
        ALTER TABLE public.inventory_movements 
        ADD COLUMN created_by UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- Ensure the profiles table has the necessary structure
-- This is a safety check in case profiles table doesn't exist or is missing the id column
DO $$ 
BEGIN
    -- Check if profiles table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'profiles' 
        AND table_schema = 'public'
    ) THEN
        -- Create profiles table if it doesn't exist
        CREATE TABLE public.profiles (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            full_name TEXT,
            email TEXT,
            role_slug TEXT DEFAULT 'user',
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        
        -- Enable RLS on profiles
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        
        -- Create RLS policies for profiles
        CREATE POLICY "Users can view their own profile" ON public.profiles
            FOR SELECT USING (auth.uid() = id);
        
        CREATE POLICY "Users can update their own profile" ON public.profiles
            FOR UPDATE USING (auth.uid() = id);
        
        CREATE POLICY "Users can insert their own profile" ON public.profiles
            FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
END $$;

-- Update RLS policies for inventory_movements to work with profiles relationship
DO $$ 
BEGIN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view inventory movements" ON public.inventory_movements;
    DROP POLICY IF EXISTS "Users can insert inventory movements" ON public.inventory_movements;
    DROP POLICY IF EXISTS "Users can update inventory movements" ON public.inventory_movements;
    
    -- Create new policies that work with profiles
    CREATE POLICY "Users can view inventory movements" ON public.inventory_movements
        FOR SELECT USING (true);
    
    CREATE POLICY "Users can insert inventory movements" ON public.inventory_movements
        FOR INSERT WITH CHECK (true);
    
    CREATE POLICY "Users can update inventory movements" ON public.inventory_movements
        FOR UPDATE USING (true);
END $$;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.inventory_movements TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
