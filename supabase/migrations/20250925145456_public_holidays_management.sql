-- Migration: Create public holidays management system
-- This migration creates public_holidays table with rate adjustments for staff wages

-- Create public_holidays table
CREATE TABLE IF NOT EXISTS public.public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  year INTEGER NOT NULL,
  markup_percentage DECIMAL(5,2) DEFAULT 0, -- e.g., 150.00 for 150% (time and a half)
  markup_amount DECIMAL(10,2) DEFAULT 0, -- fixed amount to add to base rate
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Create unique constraint to prevent duplicate holidays per year
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_holidays_date_year 
ON public.public_holidays(holiday_date, year) 
WHERE is_active = true;

-- Create index for efficient queries by year and date
CREATE INDEX IF NOT EXISTS idx_public_holidays_year_date 
ON public.public_holidays(year, holiday_date) 
WHERE is_active = true;

-- Create index for active holidays lookup
CREATE INDEX IF NOT EXISTS idx_public_holidays_active_date 
ON public.public_holidays(holiday_date) 
WHERE is_active = true;

-- Add RLS policies
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

-- Admins can manage all public holidays
DROP POLICY IF EXISTS "Admins manage public holidays" ON public.public_holidays;
CREATE POLICY "Admins manage public holidays" ON public.public_holidays
  FOR ALL
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin'))
  WITH CHECK (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin'));

-- Staff can view public holidays
DROP POLICY IF EXISTS "Staff view public holidays" ON public.public_holidays;
CREATE POLICY "Staff view public holidays" ON public.public_holidays
  FOR SELECT
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid()));

-- Create function to get holiday rate adjustment for a specific date
CREATE OR REPLACE FUNCTION get_holiday_rate_adjustment(check_date DATE)
RETURNS TABLE(
  markup_percentage DECIMAL(5,2),
  markup_amount DECIMAL(10,2)
) AS $$
  SELECT 
    COALESCE(markup_percentage, 0) as markup_percentage,
    COALESCE(markup_amount, 0) as markup_amount
  FROM public.public_holidays 
  WHERE holiday_date = check_date 
    AND is_active = true
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Create function to get all holidays for a year
CREATE OR REPLACE FUNCTION get_holidays_for_year(year_param INTEGER)
RETURNS TABLE(
  id UUID,
  name TEXT,
  holiday_date DATE,
  year INTEGER,
  markup_percentage DECIMAL(5,2),
  markup_amount DECIMAL(10,2),
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
  SELECT 
    id,
    name,
    holiday_date,
    year,
    markup_percentage,
    markup_amount,
    is_active,
    created_at,
    updated_at
  FROM public.public_holidays 
  WHERE year = year_param 
    AND is_active = true
  ORDER BY holiday_date;
$$ LANGUAGE SQL STABLE;

-- Create function to clone holidays from one year to another
CREATE OR REPLACE FUNCTION clone_holidays_to_year(
  source_year INTEGER,
  target_year INTEGER,
  created_by_user UUID
)
RETURNS INTEGER AS $$
DECLARE
  cloned_count INTEGER := 0;
  holiday_record RECORD;
BEGIN
  -- Loop through all active holidays from source year
  FOR holiday_record IN 
    SELECT * FROM public.public_holidays 
    WHERE year = source_year AND is_active = true
  LOOP
    -- Calculate new date for target year
    -- Handle leap year edge cases for Feb 29
    DECLARE
      new_date DATE;
    BEGIN
      -- Try to create the same date in target year
      BEGIN
        new_date := (target_year || '-' || 
                    EXTRACT(MONTH FROM holiday_record.holiday_date) || '-' || 
                    EXTRACT(DAY FROM holiday_record.holiday_date))::DATE;
      EXCEPTION WHEN OTHERS THEN
        -- If date doesn't exist (e.g., Feb 29 in non-leap year), use Feb 28
        new_date := (target_year || '-' || 
                    EXTRACT(MONTH FROM holiday_record.holiday_date) || '-' || 
                    LEAST(EXTRACT(DAY FROM holiday_record.holiday_date), 28))::DATE;
      END;
      
      -- Insert cloned holiday
      INSERT INTO public.public_holidays (
        name, holiday_date, year, markup_percentage, markup_amount, 
        is_active, created_by
      ) VALUES (
        holiday_record.name,
        new_date,
        target_year,
        holiday_record.markup_percentage,
        holiday_record.markup_amount,
        true,
        created_by_user
      );
      
      cloned_count := cloned_count + 1;
    END;
  END LOOP;
  
  RETURN cloned_count;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_public_holidays_updated_at ON public.public_holidays;
CREATE TRIGGER trg_public_holidays_updated_at
BEFORE UPDATE ON public.public_holidays
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Insert Victoria Australia 2025 public holidays
INSERT INTO public.public_holidays (name, holiday_date, year, markup_percentage, markup_amount, is_active) VALUES
('New Year''s Day', '2025-01-01', 2025, 150.00, 0, true),
('Australia Day', '2025-01-27', 2025, 150.00, 0, true),
('Labour Day', '2025-03-10', 2025, 150.00, 0, true),
('Good Friday', '2025-04-18', 2025, 150.00, 0, true),
('Easter Saturday', '2025-04-19', 2025, 150.00, 0, true),
('Easter Sunday', '2025-04-20', 2025, 150.00, 0, true),
('Easter Monday', '2025-04-21', 2025, 150.00, 0, true),
('ANZAC Day', '2025-04-25', 2025, 150.00, 0, true),
('King''s Birthday', '2025-06-09', 2025, 150.00, 0, true),
('Friday before AFL Grand Final', '2025-09-26', 2025, 150.00, 0, true),
('Melbourne Cup Day', '2025-11-04', 2025, 150.00, 0, true),
('Christmas Day', '2025-12-25', 2025, 150.00, 0, true),
('Boxing Day', '2025-12-26', 2025, 150.00, 0, true);

-- Add comments for documentation
COMMENT ON TABLE public.public_holidays IS 'Public holidays with rate adjustments for staff wages';
COMMENT ON COLUMN public.public_holidays.markup_percentage IS 'Percentage markup (e.g., 150.00 for time and a half)';
COMMENT ON COLUMN public.public_holidays.markup_amount IS 'Fixed amount to add to base rate';
COMMENT ON FUNCTION get_holiday_rate_adjustment(DATE) IS 'Get rate adjustment for a specific holiday date';
COMMENT ON FUNCTION get_holidays_for_year(INTEGER) IS 'Get all holidays for a specific year';
COMMENT ON FUNCTION clone_holidays_to_year(INTEGER, INTEGER, UUID) IS 'Clone holidays from one year to another';
