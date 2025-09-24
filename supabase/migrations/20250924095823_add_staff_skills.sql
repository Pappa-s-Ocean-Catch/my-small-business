-- Add skills JSON field to staff table
-- This field will store an array of section IDs that the staff member can work in

ALTER TABLE public.staff 
ADD COLUMN IF NOT EXISTS skills JSON DEFAULT '[]'::json;

-- Add comment to explain the field
COMMENT ON COLUMN public.staff.skills IS 'JSON array of section IDs that this staff member can work in. Empty array means they can work in any section.';

-- Update existing staff to have empty skills array (they can work in any section)
UPDATE public.staff 
SET skills = '[]'::json 
WHERE skills IS NULL;
