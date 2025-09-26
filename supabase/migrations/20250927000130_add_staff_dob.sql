-- Add date of birth to staff

ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS dob DATE;

COMMENT ON COLUMN public.staff.dob IS 'Date of birth (YYYY-MM-DD)';


