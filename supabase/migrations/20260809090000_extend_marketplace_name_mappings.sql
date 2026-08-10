ALTER TABLE public.marketplace_name_mappings
  ADD COLUMN IF NOT EXISTS parent_normalized_external_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS internal_entity_id UUID NULL;

ALTER TABLE public.marketplace_name_mappings
  DROP CONSTRAINT IF EXISTS marketplace_name_mappings_provider_entity_type_normalized_external_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_name_mappings_resolution_key
  ON public.marketplace_name_mappings (provider, entity_type, normalized_external_name, parent_normalized_external_name);
