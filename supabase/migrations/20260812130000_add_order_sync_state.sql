CREATE TABLE IF NOT EXISTS public.order_sync_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO public.order_sync_state (singleton)
VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.order_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_sync_state_staff_select ON public.order_sync_state;

CREATE POLICY order_sync_state_staff_select
  ON public.order_sync_state
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role_slug = 'staff'
    )
  );

CREATE OR REPLACE FUNCTION public.bump_order_sync_state()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.order_sync_state (singleton, updated_at)
  VALUES (TRUE, clock_timestamp())
  ON CONFLICT (singleton) DO UPDATE
  SET updated_at = EXCLUDED.updated_at;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS orders_bump_sync_state ON public.orders;

CREATE TRIGGER orders_bump_sync_state
  AFTER INSERT OR UPDATE OR DELETE ON public.orders
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.bump_order_sync_state();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'order_sync_state'
      AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_sync_state;
  END IF;
END $$;

ALTER TABLE public.order_sync_state REPLICA IDENTITY FULL;
