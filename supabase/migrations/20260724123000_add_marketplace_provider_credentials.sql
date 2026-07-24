CREATE TABLE IF NOT EXISTS public.marketplace_provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE CHECK (provider IN ('uber_eats', 'doordash')),
  encrypted_cookies TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  encryption_tag TEXT NOT NULL,
  configured_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.marketplace_provider_credentials IS
  'Encrypted marketplace session credentials used by POS marketplace sync flows.';

COMMENT ON COLUMN public.marketplace_provider_credentials.provider IS
  'Marketplace provider slug, such as uber_eats or doordash.';

COMMENT ON COLUMN public.marketplace_provider_credentials.encrypted_cookies IS
  'AES-GCM encrypted cookie payload stored for cross-device marketplace sync.';

ALTER TABLE public.marketplace_provider_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketplace_provider_credentials_staff_read ON public.marketplace_provider_credentials;
CREATE POLICY marketplace_provider_credentials_staff_read
ON public.marketplace_provider_credentials
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role_slug IN ('admin', 'staff')
  )
);

DROP POLICY IF EXISTS marketplace_provider_credentials_staff_write ON public.marketplace_provider_credentials;
CREATE POLICY marketplace_provider_credentials_staff_write
ON public.marketplace_provider_credentials
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role_slug IN ('admin', 'staff')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role_slug IN ('admin', 'staff')
  )
);

DROP TRIGGER IF EXISTS update_marketplace_provider_credentials_updated_at
ON public.marketplace_provider_credentials;

CREATE TRIGGER update_marketplace_provider_credentials_updated_at
  BEFORE UPDATE ON public.marketplace_provider_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
