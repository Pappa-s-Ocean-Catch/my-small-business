DO $$
DECLARE
  legacy_constraint record;
BEGIN
  FOR legacy_constraint IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'marketplace_name_mappings'
      AND con.contype = 'u'
      AND pg_get_constraintdef(con.oid) = 'UNIQUE (provider, entity_type, normalized_external_name)'
  LOOP
    EXECUTE format('ALTER TABLE public.marketplace_name_mappings DROP CONSTRAINT %I', legacy_constraint.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_name_mappings_resolution_key
  ON public.marketplace_name_mappings (provider, entity_type, normalized_external_name, parent_normalized_external_name);
