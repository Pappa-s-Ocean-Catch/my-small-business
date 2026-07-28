CREATE TABLE IF NOT EXISTS public.marketplace_name_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('uber_eats', 'doordash')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'addon', 'ingredient')),
  external_name TEXT NOT NULL,
  normalized_external_name TEXT NOT NULL,
  internal_name TEXT NOT NULL,
  notes TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (provider, entity_type, normalized_external_name)
);

CREATE TABLE IF NOT EXISTS public.marketplace_unmatched_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('uber_eats', 'doordash')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'addon', 'ingredient')),
  external_name TEXT NOT NULL,
  normalized_external_name TEXT NOT NULL,
  parent_external_name TEXT NOT NULL DEFAULT '',
  occurrences INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (provider, entity_type, normalized_external_name, parent_external_name)
);

ALTER TABLE public.marketplace_name_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_unmatched_names ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketplace_name_mappings_staff_read ON public.marketplace_name_mappings;
CREATE POLICY marketplace_name_mappings_staff_read
ON public.marketplace_name_mappings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role_slug IN ('admin', 'staff')
  )
);

DROP POLICY IF EXISTS marketplace_name_mappings_staff_write ON public.marketplace_name_mappings;
CREATE POLICY marketplace_name_mappings_staff_write
ON public.marketplace_name_mappings
FOR ALL
TO authenticated
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

DROP POLICY IF EXISTS marketplace_unmatched_names_staff_read ON public.marketplace_unmatched_names;
CREATE POLICY marketplace_unmatched_names_staff_read
ON public.marketplace_unmatched_names
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role_slug IN ('admin', 'staff')
  )
);

DROP POLICY IF EXISTS marketplace_unmatched_names_staff_write ON public.marketplace_unmatched_names;
CREATE POLICY marketplace_unmatched_names_staff_write
ON public.marketplace_unmatched_names
FOR ALL
TO authenticated
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

DROP TRIGGER IF EXISTS update_marketplace_name_mappings_updated_at
ON public.marketplace_name_mappings;
CREATE TRIGGER update_marketplace_name_mappings_updated_at
  BEFORE UPDATE ON public.marketplace_name_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_marketplace_unmatched_names_updated_at
ON public.marketplace_unmatched_names;
CREATE TRIGGER update_marketplace_unmatched_names_updated_at
  BEFORE UPDATE ON public.marketplace_unmatched_names
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
