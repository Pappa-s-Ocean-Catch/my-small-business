ALTER TABLE public.order_events
  ADD COLUMN IF NOT EXISTS payload_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_order_events_source_payload_hash
  ON public.order_events(source, payload_hash);

CREATE INDEX IF NOT EXISTS idx_order_events_order_payload_hash
  ON public.order_events(order_id, payload_hash);

COMMENT ON COLUMN public.order_events.payload_hash IS
  'Stable SHA-256 hash of the raw provider payload for duplicate detection';
