-- Fix payment instructions unique constraint to allow multiple records per staff/priority
-- when only one is current at a time

-- Drop the existing unique index
DROP INDEX IF EXISTS staff_payment_instructions_staff_priority_idx;

-- Create a new unique index that only applies to current records
-- This allows multiple historical records with the same priority but only one current
CREATE UNIQUE INDEX staff_payment_instructions_staff_priority_current_idx
  ON public.staff_payment_instructions(staff_id, priority)
  WHERE is_current = true;

-- Add a comment explaining the constraint
COMMENT ON INDEX staff_payment_instructions_staff_priority_current_idx IS 
'Ensures only one current payment instruction per staff member per priority level. Historical records can have duplicate priorities.';
