ALTER TABLE public.brand_settings
  ADD COLUMN IF NOT EXISTS legal_name TEXT,
  ADD COLUMN IF NOT EXISTS abn TEXT,
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours TEXT;

UPDATE public.brand_settings
SET legal_name = COALESCE(NULLIF(legal_name, ''), 'T.K.O CHIPPERY PTY LTD'),
    abn = COALESCE(NULLIF(abn, ''), '20 689 326 547')
WHERE legal_name IS NULL OR legal_name = '' OR abn IS NULL OR abn = '';

DROP POLICY IF EXISTS "Staff can view store information" ON public.brand_settings;
CREATE POLICY "Staff can view store information" ON public.brand_settings
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug IN ('staff', 'admin')));

DROP POLICY IF EXISTS "Staff can update store information" ON public.brand_settings;
CREATE POLICY "Staff can update store information" ON public.brand_settings
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug IN ('staff', 'admin')));
