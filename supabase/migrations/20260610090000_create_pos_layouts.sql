CREATE TABLE IF NOT EXISTS public.pos_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_layouts_default ON public.pos_layouts(is_default);
CREATE INDEX IF NOT EXISTS idx_pos_layouts_created_at ON public.pos_layouts(created_at);

CREATE OR REPLACE FUNCTION public.set_pos_layout_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_pos_layout_updated_at ON public.pos_layouts;
CREATE TRIGGER set_pos_layout_updated_at
  BEFORE UPDATE ON public.pos_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pos_layout_updated_at();

ALTER TABLE public.pos_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pos_layouts_staff_read ON public.pos_layouts;
DROP POLICY IF EXISTS pos_layouts_staff_insert ON public.pos_layouts;
DROP POLICY IF EXISTS pos_layouts_staff_update ON public.pos_layouts;
DROP POLICY IF EXISTS pos_layouts_admin_delete ON public.pos_layouts;

CREATE POLICY pos_layouts_staff_read ON public.pos_layouts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role_slug IN ('staff', 'admin')
    )
  );

CREATE POLICY pos_layouts_staff_insert ON public.pos_layouts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role_slug IN ('staff', 'admin')
    )
  );

CREATE POLICY pos_layouts_staff_update ON public.pos_layouts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role_slug IN ('staff', 'admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role_slug IN ('staff', 'admin')
    )
  );

CREATE POLICY pos_layouts_admin_delete ON public.pos_layouts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role_slug = 'admin'
    )
  );
