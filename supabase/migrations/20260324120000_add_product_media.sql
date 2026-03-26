-- Migration: Add sales_product_media table for 1:m product media (image/video)

CREATE TABLE IF NOT EXISTS public.sales_product_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_product_id UUID REFERENCES public.sale_products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'video')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  publish_status BOOLEAN NOT NULL DEFAULT true
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_sales_product_media_sale_product_id ON public.sales_product_media(sale_product_id, sort_order);

-- RLS (optional, for now allow all, can restrict later)
ALTER TABLE public.sales_product_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_product_media_read_all ON public.sales_product_media FOR SELECT USING (true);
CREATE POLICY sales_product_media_admin_write ON public.sales_product_media FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role_slug = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role_slug = 'admin')
);
