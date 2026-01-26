-- Add multiple_choice flag to addon_groups
-- Controls whether users can select multiple items from an add-on group (checkboxes) or only one (radio)

ALTER TABLE public.addon_groups
ADD COLUMN IF NOT EXISTS multiple_choice BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.addon_groups.multiple_choice IS 'If true, customer may select multiple add-on items from this group; if false, select at most one.';
