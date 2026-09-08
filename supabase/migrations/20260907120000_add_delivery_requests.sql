CREATE TABLE public.delivery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  state TEXT NOT NULL,
  shipday_order_id TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  quotes JSONB NOT NULL DEFAULT '[]'::jsonb,
  address JSONB NOT NULL,
  recipient JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  last_error TEXT,
  tracking_url TEXT,
  selected_provider TEXT,
  accepted_fee NUMERIC,
  currency TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.delivery_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY delivery_requests_staff_select ON public.delivery_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role_slug = 'staff')
  );

-- Only service role (server-only mutation) can mutate.
-- The default behavior of RLS is to deny all if no policy matches, but service_role bypasses RLS.
-- So we don't need to add explicit INSERT/UPDATE policies for service_role.

-- Add updated_at trigger
CREATE TRIGGER set_delivery_requests_updated_at
BEFORE UPDATE ON public.delivery_requests
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
