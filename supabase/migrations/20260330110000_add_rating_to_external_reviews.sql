-- Migration: add rating column to external_reviews and backfill
ALTER TABLE external_reviews ADD COLUMN IF NOT EXISTS rating NUMERIC;

-- Backfill rating as average of value, delivery, food (ignoring nulls)
UPDATE external_reviews
SET rating = (
  (COALESCE(value, 0) + COALESCE(delivery, 0) + COALESCE(food, 0)) /
  NULLIF((CASE WHEN value IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN delivery IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN food IS NOT NULL THEN 1 ELSE 0 END), 0)
)
WHERE rating IS NULL;
