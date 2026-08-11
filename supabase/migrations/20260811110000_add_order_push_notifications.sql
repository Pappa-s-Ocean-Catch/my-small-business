-- Notification infrastructure is intentionally isolated from public.orders.
-- No trigger, foreign key, policy, or function in this migration reads or writes orders.

CREATE TABLE IF NOT EXISTS public.order_management_push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL UNIQUE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_management_push_devices_user_id_idx
  ON public.order_management_push_devices (user_id);

ALTER TABLE public.order_management_push_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_management_push_devices_staff_upsert
  ON public.order_management_push_devices
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role_slug IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role_slug IN ('admin', 'staff')
    )
  );

CREATE TABLE IF NOT EXISTS public.push_notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  event_type text NOT NULL CHECK (event_type = 'new_order'),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0 AND attempt_count <= 5),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_notification_jobs_retry_idx
  ON public.push_notification_jobs (next_attempt_at)
  WHERE status IN ('pending', 'failed');

ALTER TABLE public.push_notification_jobs ENABLE ROW LEVEL SECURITY;
