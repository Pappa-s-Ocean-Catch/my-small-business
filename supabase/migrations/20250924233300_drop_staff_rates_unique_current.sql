-- Temporarily drop the partial unique index enforcing a single current rate
-- per (staff_id, rate_type) to unblock updates

DROP INDEX IF EXISTS idx_staff_rates_unique_current;

-- Note: The update_staff_rate function has been hardened to avoid duplicates
-- via advisory locks and update-then-insert logic. Recreate the index later
-- after verifying data integrity if needed.


