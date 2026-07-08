-- Add provider-agnostic delivery tracking support and raw order event capture.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_status TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_delivery_status_check'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_delivery_status_check;
  END IF;
END $$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_status_check
  CHECK (
    delivery_status IS NULL OR delivery_status IN (
      'pending',
      'assigned',
      'inflight',
      'delivered',
      'quote_requested',
      'quote_received',
      'delivery_created',
      'driver_assigned',
      'picked_up',
      'in_transit',
      'cancelled',
      'failed'
    )
  );

CREATE TABLE IF NOT EXISTS public.order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT,
  message TEXT,
  external_order_number TEXT,
  external_delivery_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id
  ON public.order_events(order_id);

CREATE INDEX IF NOT EXISTS idx_order_events_source_created_at
  ON public.order_events(source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_events_external_delivery_id
  ON public.order_events(external_delivery_id);

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_events_customer_read ON public.order_events;
CREATE POLICY order_events_customer_read ON public.order_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (
          o.user_id = auth.uid() OR
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin')
        )
    )
  );

DROP POLICY IF EXISTS order_events_admin_all ON public.order_events;
CREATE POLICY order_events_admin_all ON public.order_events FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin'));

COMMENT ON TABLE public.order_events IS
  'Raw inbound/outbound order provider events for debugging and audit history';

COMMENT ON COLUMN public.order_events.details IS
  'Full provider event payload stored as JSONB for troubleshooting';

COMMENT ON COLUMN public.orders.delivery_status IS
  'Normalized delivery lifecycle status across external delivery providers';
