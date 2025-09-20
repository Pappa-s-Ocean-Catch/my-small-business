-- Migration: Remove old rate fields from staff table
-- This migration removes the old rate fields that have been migrated to staff_rates table

-- Remove old rate fields from staff table
ALTER TABLE staff DROP COLUMN IF EXISTS default_rate;
ALTER TABLE staff DROP COLUMN IF EXISTS pay_rate;
ALTER TABLE staff DROP COLUMN IF EXISTS mon_rate;
ALTER TABLE staff DROP COLUMN IF EXISTS tue_rate;
ALTER TABLE staff DROP COLUMN IF EXISTS wed_rate;
ALTER TABLE staff DROP COLUMN IF EXISTS thu_rate;
ALTER TABLE staff DROP COLUMN IF EXISTS fri_rate;
ALTER TABLE staff DROP COLUMN IF EXISTS sat_rate;
ALTER TABLE staff DROP COLUMN IF EXISTS sun_rate;

-- Add comment to document the cleanup
COMMENT ON TABLE staff IS 'Staff table - rate fields have been moved to staff_rates table for temporal data management';
