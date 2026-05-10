-- Migration to fix security vulnerabilities flagged by Supabase Advisor
-- 1. Set security_invoker = true for identified views
-- 2. Enable RLS and add policies for tables missing them

-- Fix Views: SECURITY DEFINER -> SECURITY INVOKER
ALTER VIEW IF EXISTS public.products_with_stock_status SET (security_invoker = true);
ALTER VIEW IF EXISTS public.products_with_box_inventory SET (security_invoker = true);
ALTER VIEW IF EXISTS public.inventory_movement_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS public.inventory_financial_summary SET (security_invoker = true);
ALTER VIEW IF EXISTS public.menu_with_hierarchy SET (security_invoker = true);
ALTER VIEW IF EXISTS public.customer_summary SET (security_invoker = true);

-- Fix Table: public.roles
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Roles are viewable by everyone" ON public.roles;
CREATE POLICY "Roles are viewable by everyone" ON public.roles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;
CREATE POLICY "Admins can manage roles" ON public.roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role_slug = 'admin'
    )
  );

-- Fix Table: public.external_reviews
ALTER TABLE public.external_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "External reviews are viewable by everyone" ON public.external_reviews;
CREATE POLICY "External reviews are viewable by everyone" ON public.external_reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage external reviews" ON public.external_reviews;
CREATE POLICY "Admins can manage external reviews" ON public.external_reviews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role_slug = 'admin'
    )
  );

-- Fix Table: public.item_likes
ALTER TABLE public.item_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Item likes are viewable by everyone" ON public.item_likes;
CREATE POLICY "Item likes are viewable by everyone" ON public.item_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own likes" ON public.item_likes;
CREATE POLICY "Users can manage their own likes" ON public.item_likes
  FOR ALL USING (auth.uid() = user_id);

-- Fix Table: public.item_reviews
ALTER TABLE public.item_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Item reviews are viewable by everyone" ON public.item_reviews;
CREATE POLICY "Item reviews are viewable by everyone" ON public.item_reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own reviews" ON public.item_reviews;
CREATE POLICY "Users can manage their own reviews" ON public.item_reviews
  FOR ALL USING (auth.uid() = user_id);

-- Fix Table: public.item_review_photos
ALTER TABLE public.item_review_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Item review photos are viewable by everyone" ON public.item_review_photos;
CREATE POLICY "Item review photos are viewable by everyone" ON public.item_review_photos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage photos for their own reviews" ON public.item_review_photos;
CREATE POLICY "Users can manage photos for their own reviews" ON public.item_review_photos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.item_reviews
      WHERE id = review_id AND user_id = auth.uid()
    )
  );
