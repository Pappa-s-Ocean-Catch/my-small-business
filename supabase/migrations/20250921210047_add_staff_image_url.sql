-- Add image_url field to staff table
-- This migration adds image upload capability for staff members

-- Add image_url field to staff table
ALTER TABLE public.staff 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.staff.image_url IS 'URL of the staff member photo stored in Vercel Blob';
