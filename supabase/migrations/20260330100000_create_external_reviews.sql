-- Migration: create external_reviews table
CREATE TABLE IF NOT EXISTS external_reviews (
  id BIGINT PRIMARY KEY,
  host TEXT,
  product_id INTEGER,
  platform_id INTEGER,
  message TEXT,
  response TEXT,
  value NUMERIC,
  delivery NUMERIC,
  food NUMERIC,
  name TEXT,
  date TIMESTAMP,
  active BOOLEAN,
  portal TEXT,
  created_at TIMESTAMP,
  replied_at TIMESTAMP,
  updated_at TIMESTAMP,
  source TEXT
);

-- Index for faster upsert
CREATE INDEX IF NOT EXISTS idx_external_reviews_id ON external_reviews(id);