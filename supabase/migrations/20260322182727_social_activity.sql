-- Social Activity: Likes, Reviews, Ratings, Photos
-- Likes table: users can like/dislike items
CREATE TABLE IF NOT EXISTS public.item_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.sale_products(id) ON DELETE CASCADE,
  is_like boolean NOT NULL,
  created_at timestamptz DEFAULT timezone('utc', now()),
  UNIQUE(user_id, item_id)
);

-- Item reviews: comment, rating, photo
CREATE TABLE IF NOT EXISTS public.item_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.sale_products(id) ON DELETE CASCADE,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT timezone('utc', now())
);

-- Review photos (multiple per review)
CREATE TABLE IF NOT EXISTS public.item_review_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES public.item_reviews(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz DEFAULT timezone('utc', now())
);

-- Order reviews: comment, rating
CREATE TABLE IF NOT EXISTS public.order_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT timezone('utc', now()),
  UNIQUE(user_id, order_id)
);
