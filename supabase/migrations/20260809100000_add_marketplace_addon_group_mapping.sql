ALTER TABLE public.marketplace_name_mappings DROP CONSTRAINT IF EXISTS marketplace_name_mappings_entity_type_check;
ALTER TABLE public.marketplace_name_mappings ADD CONSTRAINT marketplace_name_mappings_entity_type_check CHECK (entity_type IN ('product', 'addon_group', 'addon', 'ingredient'));
ALTER TABLE public.marketplace_unmatched_names DROP CONSTRAINT IF EXISTS marketplace_unmatched_names_entity_type_check;
ALTER TABLE public.marketplace_unmatched_names ADD CONSTRAINT marketplace_unmatched_names_entity_type_check CHECK (entity_type IN ('product', 'addon_group', 'addon', 'ingredient'));
