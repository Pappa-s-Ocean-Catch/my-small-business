-- Migration: Add opt-in flag for public holiday wage rules to staff

ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS applies_public_holiday_rules BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.staff.applies_public_holiday_rules IS 'If true, staff wages are adjusted per public holiday rules; if false, no holiday markup applied.';


