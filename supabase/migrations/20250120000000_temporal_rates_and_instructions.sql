-- Migration: Create temporal rates table and add temporal fields to payment instructions
-- This migration creates staff_rates table and adds temporal fields to staff_payment_instructions

-- Create staff_rates table with temporal fields
CREATE TABLE IF NOT EXISTS staff_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  rate DECIMAL NOT NULL,
  rate_type VARCHAR(10) NOT NULL DEFAULT 'default', -- 'default', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL DEFAULT '9999-12-31',
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add temporal fields to staff_payment_instructions table
ALTER TABLE staff_payment_instructions
ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS end_date DATE DEFAULT '9999-12-31',
ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Migrate existing rate data from staff table to staff_rates
-- Migrate default_rate, pay_rate, and weekday rates
INSERT INTO staff_rates (staff_id, rate, rate_type, effective_date, end_date, is_current, created_at)
SELECT 
    id as staff_id,
    COALESCE(default_rate, pay_rate) as rate,
    'default' as rate_type,
    CURRENT_DATE as effective_date,
    '9999-12-31' as end_date,
    true as is_current,
    NOW() as created_at
FROM staff 
WHERE COALESCE(default_rate, pay_rate) IS NOT NULL 
  AND COALESCE(default_rate, pay_rate) > 0;

-- Migrate weekday rates as separate entries
INSERT INTO staff_rates (staff_id, rate, rate_type, effective_date, end_date, is_current, created_at)
SELECT 
    id as staff_id,
    mon_rate as rate,
    'mon' as rate_type,
    CURRENT_DATE as effective_date,
    '9999-12-31' as end_date,
    true as is_current,
    NOW() as created_at
FROM staff 
WHERE mon_rate IS NOT NULL AND mon_rate > 0;

INSERT INTO staff_rates (staff_id, rate, rate_type, effective_date, end_date, is_current, created_at)
SELECT 
    id as staff_id,
    tue_rate as rate,
    'tue' as rate_type,
    CURRENT_DATE as effective_date,
    '9999-12-31' as end_date,
    true as is_current,
    NOW() as created_at
FROM staff 
WHERE tue_rate IS NOT NULL AND tue_rate > 0;

INSERT INTO staff_rates (staff_id, rate, rate_type, effective_date, end_date, is_current, created_at)
SELECT 
    id as staff_id,
    wed_rate as rate,
    'wed' as rate_type,
    CURRENT_DATE as effective_date,
    '9999-12-31' as end_date,
    true as is_current,
    NOW() as created_at
FROM staff 
WHERE wed_rate IS NOT NULL AND wed_rate > 0;

INSERT INTO staff_rates (staff_id, rate, rate_type, effective_date, end_date, is_current, created_at)
SELECT 
    id as staff_id,
    thu_rate as rate,
    'thu' as rate_type,
    CURRENT_DATE as effective_date,
    '9999-12-31' as end_date,
    true as is_current,
    NOW() as created_at
FROM staff 
WHERE thu_rate IS NOT NULL AND thu_rate > 0;

INSERT INTO staff_rates (staff_id, rate, rate_type, effective_date, end_date, is_current, created_at)
SELECT 
    id as staff_id,
    fri_rate as rate,
    'fri' as rate_type,
    CURRENT_DATE as effective_date,
    '9999-12-31' as end_date,
    true as is_current,
    NOW() as created_at
FROM staff 
WHERE fri_rate IS NOT NULL AND fri_rate > 0;

INSERT INTO staff_rates (staff_id, rate, rate_type, effective_date, end_date, is_current, created_at)
SELECT 
    id as staff_id,
    sat_rate as rate,
    'sat' as rate_type,
    CURRENT_DATE as effective_date,
    '9999-12-31' as end_date,
    true as is_current,
    NOW() as created_at
FROM staff 
WHERE sat_rate IS NOT NULL AND sat_rate > 0;

INSERT INTO staff_rates (staff_id, rate, rate_type, effective_date, end_date, is_current, created_at)
SELECT 
    id as staff_id,
    sun_rate as rate,
    'sun' as rate_type,
    CURRENT_DATE as effective_date,
    '9999-12-31' as end_date,
    true as is_current,
    NOW() as created_at
FROM staff 
WHERE sun_rate IS NOT NULL AND sun_rate > 0;

-- Set all existing staff_rates records as current (if they don't have temporal fields set)
UPDATE staff_rates 
SET 
    effective_date = COALESCE(effective_date, CURRENT_DATE),
    end_date = COALESCE(end_date, '9999-12-31'),
    is_current = COALESCE(is_current, true),
    created_at = COALESCE(created_at, NOW())
WHERE effective_date IS NULL OR end_date IS NULL OR is_current IS NULL OR created_at IS NULL;

-- Set all existing staff_payment_instructions records as current
UPDATE staff_payment_instructions 
SET 
    effective_date = COALESCE(effective_date, CURRENT_DATE),
    end_date = COALESCE(end_date, '9999-12-31'),
    is_current = COALESCE(is_current, true),
    created_at = COALESCE(created_at, NOW())
WHERE effective_date IS NULL OR end_date IS NULL OR is_current IS NULL OR created_at IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_rates_current ON staff_rates (staff_id, is_current);
CREATE INDEX IF NOT EXISTS idx_staff_rates_dates ON staff_rates (staff_id, effective_date, end_date);
CREATE INDEX IF NOT EXISTS idx_payment_instructions_current ON staff_payment_instructions (staff_id, is_current, active);
CREATE INDEX IF NOT EXISTS idx_payment_instructions_dates ON staff_payment_instructions (staff_id, effective_date, end_date);

-- Create unique constraint to ensure only one current rate per staff per rate type
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_rates_unique_current 
ON staff_rates (staff_id, rate_type) 
WHERE is_current = true;

-- Create functions for getting current rates and instructions
CREATE OR REPLACE FUNCTION get_current_staff_rate(staff_id UUID, date DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL AS $$
  SELECT rate FROM staff_rates 
  WHERE staff_id = $1 
    AND rate_type = 'default'
    AND effective_date <= $2 
    AND end_date >= $2
    AND is_current = true
  ORDER BY effective_date DESC 
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Function to get staff rate for a specific day of week
CREATE OR REPLACE FUNCTION get_staff_rate_for_day(staff_id UUID, day_of_week INTEGER, date DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL AS $$
DECLARE
  rate_type_name VARCHAR(10);
  day_rate DECIMAL;
  default_rate DECIMAL;
BEGIN
  -- Map day of week (0=Sunday, 1=Monday, etc.) to rate type
  rate_type_name := CASE day_of_week
    WHEN 0 THEN 'sun'
    WHEN 1 THEN 'mon'
    WHEN 2 THEN 'tue'
    WHEN 3 THEN 'wed'
    WHEN 4 THEN 'thu'
    WHEN 5 THEN 'fri'
    WHEN 6 THEN 'sat'
    ELSE 'default'
  END;
  
  -- Get specific day rate
  SELECT rate INTO day_rate FROM staff_rates 
  WHERE staff_id = $1 
    AND rate_type = rate_type_name
    AND effective_date <= $2 
    AND end_date >= $2
    AND is_current = true
  ORDER BY effective_date DESC 
  LIMIT 1;
  
  -- If no specific day rate, get default rate
  IF day_rate IS NULL THEN
    SELECT rate INTO default_rate FROM staff_rates 
    WHERE staff_id = $1 
      AND rate_type = 'default'
      AND effective_date <= $2 
      AND end_date >= $2
      AND is_current = true
    ORDER BY effective_date DESC 
    LIMIT 1;
    RETURN COALESCE(default_rate, 0);
  END IF;
  
  RETURN COALESCE(day_rate, 0);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_current_payment_instructions(staff_id UUID, date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
    id UUID,
    label TEXT,
    adjustment_per_hour DECIMAL,
    weekly_hours_cap INTEGER,
    payment_method TEXT,
    priority INTEGER,
    active BOOLEAN,
    effective_date DATE,
    end_date DATE,
    is_current BOOLEAN
) AS $$
  SELECT 
    id,
    label,
    adjustment_per_hour,
    weekly_hours_cap,
    payment_method,
    priority,
    active,
    effective_date,
    end_date,
    is_current
  FROM staff_payment_instructions 
  WHERE staff_id = $1 
    AND effective_date <= $2 
    AND end_date >= $2
    AND is_current = true
    AND active = true
  ORDER BY priority;
$$ LANGUAGE SQL STABLE;

-- Create function to update staff rate (handles temporal logic)
CREATE OR REPLACE FUNCTION update_staff_rate(
    p_staff_id UUID,
    p_new_rate DECIMAL,
    p_rate_type VARCHAR(10) DEFAULT 'default',
    p_effective_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
BEGIN
    -- Mark current rate as historical
    UPDATE staff_rates 
    SET 
        end_date = p_effective_date - INTERVAL '1 day',
        is_current = false
    WHERE staff_id = p_staff_id 
      AND rate_type = p_rate_type
      AND is_current = true;
    
    -- Insert new current rate
    INSERT INTO staff_rates (staff_id, rate, rate_type, effective_date, end_date, is_current, created_at)
    VALUES (p_staff_id, p_new_rate, p_rate_type, p_effective_date, '9999-12-31', true, NOW());
END;
$$ LANGUAGE plpgsql;

-- Create function to update payment instruction (handles temporal logic)
CREATE OR REPLACE FUNCTION update_payment_instruction(
    p_instruction_id UUID,
    p_label TEXT,
    p_adjustment_per_hour DECIMAL,
    p_weekly_hours_cap INTEGER,
    p_payment_method TEXT,
    p_priority INTEGER,
    p_active BOOLEAN,
    p_effective_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
BEGIN
    -- Mark current instruction as historical
    UPDATE staff_payment_instructions 
    SET 
        end_date = p_effective_date - INTERVAL '1 day',
        is_current = false
    WHERE id = p_instruction_id 
      AND is_current = true;
    
    -- Insert new current instruction
    INSERT INTO staff_payment_instructions (
        staff_id, label, adjustment_per_hour, weekly_hours_cap, 
        payment_method, priority, active, effective_date, end_date, is_current, created_at
    )
    SELECT 
        staff_id, p_label, p_adjustment_per_hour, p_weekly_hours_cap,
        p_payment_method, p_priority, p_active, p_effective_date, '9999-12-31', true, NOW()
    FROM staff_payment_instructions 
    WHERE id = p_instruction_id;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for staff_rates table
ALTER TABLE staff_rates ENABLE ROW LEVEL SECURITY;

-- Admins manage all staff rates
DROP POLICY IF EXISTS "Admins manage staff rates" ON staff_rates;
CREATE POLICY "Admins manage staff rates" ON staff_rates
  FOR ALL
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin'))
  WITH CHECK (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin'));

-- Staff can view their own rates
DROP POLICY IF EXISTS "Staff view own rates" ON staff_rates;
CREATE POLICY "Staff view own rates" ON staff_rates
  FOR SELECT
  USING (exists (
    select 1 from public.staff s
    join public.profiles p on p.id = s.id
    where s.id = staff_rates.staff_id and p.id = auth.uid()
  ));

-- Add comments for documentation
COMMENT ON TABLE staff_rates IS 'Temporal table storing staff rates with effective dates and rate types (default, mon, tue, wed, thu, fri, sat, sun)';
COMMENT ON FUNCTION get_current_staff_rate(UUID, DATE) IS 'Get the current default rate for a staff member on a specific date';
COMMENT ON FUNCTION get_staff_rate_for_day(UUID, INTEGER, DATE) IS 'Get the current rate for a staff member on a specific day of week (0=Sunday, 1=Monday, etc.)';
COMMENT ON FUNCTION get_current_payment_instructions(UUID, DATE) IS 'Get current active payment instructions for a staff member on a specific date';
COMMENT ON FUNCTION update_staff_rate(UUID, DECIMAL, VARCHAR, DATE) IS 'Update staff rate with temporal versioning for a specific rate type';
COMMENT ON FUNCTION update_payment_instruction(UUID, TEXT, DECIMAL, INTEGER, TEXT, INTEGER, BOOLEAN, DATE) IS 'Update payment instruction with temporal versioning';
