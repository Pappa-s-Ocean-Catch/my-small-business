CREATE TABLE IF NOT EXISTS public.pos_mirror_state (
  register_id TEXT PRIMARY KEY,
  current_order JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.pos_mirror_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pos_mirror_state_staff_admin_select
ON public.pos_mirror_state;

CREATE POLICY pos_mirror_state_staff_admin_select
ON public.pos_mirror_state
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role_slug IN ('staff', 'admin')
  )
);

DROP POLICY IF EXISTS pos_mirror_state_staff_admin_insert
ON public.pos_mirror_state;

CREATE POLICY pos_mirror_state_staff_admin_insert
ON public.pos_mirror_state
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role_slug IN ('staff', 'admin')
  )
);

DROP POLICY IF EXISTS pos_mirror_state_staff_admin_update
ON public.pos_mirror_state;

CREATE POLICY pos_mirror_state_staff_admin_update
ON public.pos_mirror_state
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role_slug IN ('staff', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role_slug IN ('staff', 'admin')
  )
);

DROP POLICY IF EXISTS order_sync_state_staff_select
ON public.order_sync_state;

CREATE POLICY order_sync_state_staff_select
ON public.order_sync_state
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role_slug IN ('staff', 'admin')
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pos_mirror_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_mirror_state;
  END IF;
END $$;

ALTER TABLE public.pos_mirror_state REPLICA IDENTITY FULL;
