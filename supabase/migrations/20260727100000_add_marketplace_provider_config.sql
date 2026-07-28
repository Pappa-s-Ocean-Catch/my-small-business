ALTER TABLE public.marketplace_provider_credentials
ADD COLUMN IF NOT EXISTS provider_config JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.marketplace_provider_credentials.provider_config IS
  'Provider-specific configuration such as DoorDash businessId and storeId.';
