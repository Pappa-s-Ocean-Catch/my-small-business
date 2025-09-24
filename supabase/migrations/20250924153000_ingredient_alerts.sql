-- Add ingredient-based alerts for sale products

-- 1) Add thresholds on sale products (warning/alert in buildable units)
ALTER TABLE public.sale_products
ADD COLUMN IF NOT EXISTS warning_threshold_units INTEGER,
ADD COLUMN IF NOT EXISTS alert_threshold_units INTEGER;

-- 2) Ingredient stock notifications table
CREATE TABLE IF NOT EXISTS public.ingredient_stock_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_product_id UUID NOT NULL REFERENCES public.sale_products(id) ON DELETE CASCADE,
  buildable_units INTEGER NOT NULL DEFAULT 0,
  warning_threshold INTEGER,
  alert_threshold INTEGER,
  missing_ingredients JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{product_id, product_name, required, available}]
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_ingredient_stock_notifications_active
ON public.ingredient_stock_notifications (is_resolved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingredient_stock_notifications_sale_product
ON public.ingredient_stock_notifications (sale_product_id);

-- Enable RLS and policies
ALTER TABLE public.ingredient_stock_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'ingredient_alerts_select_authenticated'
      AND schemaname = 'public'
      AND tablename = 'ingredient_stock_notifications'
  ) THEN
    CREATE POLICY ingredient_alerts_select_authenticated
      ON public.ingredient_stock_notifications
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'ingredient_alerts_admin_manage'
      AND schemaname = 'public'
      AND tablename = 'ingredient_stock_notifications'
  ) THEN
    CREATE POLICY ingredient_alerts_admin_manage
      ON public.ingredient_stock_notifications
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid() AND profiles.role_slug = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid() AND profiles.role_slug = 'admin'
        )
      );
  END IF;
END $$;


