-- Add secret_ref to suppliers to reference external secret (e.g., Doppler)

ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS secret_ref TEXT;

COMMENT ON COLUMN public.suppliers.secret_ref IS 'Reference/key to external secret holding credentials (e.g., Doppler secret name)';

-- Optional: ensure name stays unique (already handled elsewhere) and document usage
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'suppliers_secret_ref_format_check'
    ) THEN
        -- Keep constraint simple and non-breaking: allow NULL or non-empty text
        ALTER TABLE public.suppliers 
        ADD CONSTRAINT suppliers_secret_ref_format_check 
        CHECK (secret_ref IS NULL OR length(trim(secret_ref)) > 0);
    END IF;
END $$;


