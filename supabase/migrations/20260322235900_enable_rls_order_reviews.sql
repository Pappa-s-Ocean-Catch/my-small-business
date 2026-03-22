-- Enable RLS and allow users to read their own order reviews
ALTER TABLE public.order_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_reviews_select_own ON public.order_reviews;
CREATE POLICY order_reviews_select_own ON public.order_reviews
  FOR SELECT USING (auth.uid() = user_id);
