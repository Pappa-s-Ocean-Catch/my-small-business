-- Add image_url and website fields to suppliers table
-- This migration adds image upload capability and website link to suppliers

-- Add image_url field to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add website field to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS website TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.suppliers.image_url IS 'URL of the supplier logo/image stored in Vercel Blob';
COMMENT ON COLUMN public.suppliers.website IS 'Website URL of the supplier';

-- Add constraint to ensure website URL is valid (optional)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'suppliers_website_url_check'
    ) THEN
        ALTER TABLE public.suppliers 
        ADD CONSTRAINT suppliers_website_url_check 
        CHECK (website IS NULL OR website ~ '^https?://');
    END IF;
END $$;
