-- Add a generic delivery provider identifier alongside the legacy Uber-specific field.
-- This avoids rename-related rollout issues while letting the app move to provider-agnostic naming.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_provider_id TEXT;

UPDATE public.orders
SET delivery_provider_id = uber_delivery_id
WHERE delivery_provider_id IS NULL
  AND uber_delivery_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_provider_id
  ON public.orders(delivery_provider_id);

COMMENT ON COLUMN public.orders.delivery_provider_id IS
  'Generic delivery provider ID after external delivery request is created';
