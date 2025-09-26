-- Migration: Drop legacy staff rate columns in favor of staff_rates table
-- This migration removes deprecated rate columns from public.staff

-- 1) Ensure columns exist before dropping
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'default_rate'
    ) THEN
        ALTER TABLE public.staff DROP COLUMN default_rate;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'mon_rate'
    ) THEN
        ALTER TABLE public.staff DROP COLUMN mon_rate;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'tue_rate'
    ) THEN
        ALTER TABLE public.staff DROP COLUMN tue_rate;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'wed_rate'
    ) THEN
        ALTER TABLE public.staff DROP COLUMN wed_rate;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'thu_rate'
    ) THEN
        ALTER TABLE public.staff DROP COLUMN thu_rate;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'fri_rate'
    ) THEN
        ALTER TABLE public.staff DROP COLUMN fri_rate;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'sat_rate'
    ) THEN
        ALTER TABLE public.staff DROP COLUMN sat_rate;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'sun_rate'
    ) THEN
        ALTER TABLE public.staff DROP COLUMN sun_rate;
    END IF;
END $$;


