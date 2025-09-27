-- Migration: Add brand settings table for business branding
CREATE TABLE IF NOT EXISTS public.brand_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL DEFAULT 'OperateFlow',
  slogan TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default brand settings
INSERT INTO public.brand_settings (business_name, slogan) 
VALUES ('OperateFlow', 'Streamline Your Operations')
ON CONFLICT DO NOTHING;

-- Add RLS policies
ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;

-- Allow admins to read and update brand settings
CREATE POLICY "Admins can view brand settings" ON public.brand_settings
  FOR SELECT USING (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
  );

CREATE POLICY "Admins can update brand settings" ON public.brand_settings
  FOR UPDATE USING (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
  );

CREATE POLICY "Admins can insert brand settings" ON public.brand_settings
  FOR INSERT WITH CHECK (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
  );

-- Add comments
COMMENT ON TABLE public.brand_settings IS 'Brand configuration settings for business identity';
COMMENT ON COLUMN public.brand_settings.business_name IS 'The business name displayed in emails and UI';
COMMENT ON COLUMN public.brand_settings.slogan IS 'Business slogan or tagline';
COMMENT ON COLUMN public.brand_settings.logo_url IS 'URL of the business logo image';
