-- Migration: Add reward points system
-- This includes reward point settings, transactions, and user balances

-- 1. Add reward point settings to settings table
INSERT INTO public.settings (key, value)
VALUES (
  'reward_points',
  jsonb_build_object(
    'points_per_dollar', 10, -- 1 dollar = 10 points
    'dollars_per_point', 0.001, -- 1000 points = 1 dollar
    'enabled', true
  )
)
ON CONFLICT (key) DO NOTHING;

-- 2. Create reward_point_transactions table
CREATE TABLE IF NOT EXISTS public.reward_point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL, -- Reference to order that earned/used points
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earned', 'used', 'expired', 'adjusted')),
  points INTEGER NOT NULL, -- Positive for earned, negative for used/expired
  points_balance_after INTEGER NOT NULL, -- Balance after this transaction
  description TEXT, -- Human-readable description
  metadata JSONB, -- Additional data (order amount, conversion rate, etc.)
  expires_at TIMESTAMPTZ, -- When points expire (optional)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create user_reward_points table (denormalized balance for quick access)
CREATE TABLE IF NOT EXISTS public.user_reward_points (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_points_earned INTEGER NOT NULL DEFAULT 0,
  total_points_used INTEGER NOT NULL DEFAULT 0,
  total_points_expired INTEGER NOT NULL DEFAULT 0,
  current_balance INTEGER NOT NULL DEFAULT 0, -- Calculated: earned - used - expired
  last_transaction_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Add reward_points_used and reward_points_value to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS reward_points_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_points_value DECIMAL(10,2) DEFAULT 0; -- Dollar value of points used

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reward_point_transactions_user_id ON public.reward_point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_point_transactions_order_id ON public.reward_point_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_reward_point_transactions_type ON public.reward_point_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_reward_point_transactions_created_at ON public.reward_point_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reward_points_balance ON public.user_reward_points(current_balance DESC);

-- RLS for reward_point_transactions
ALTER TABLE public.reward_point_transactions ENABLE ROW LEVEL SECURITY;

-- Customers can read their own transactions, admins can read all
DROP POLICY IF EXISTS reward_point_transactions_customer_read ON public.reward_point_transactions;
CREATE POLICY reward_point_transactions_customer_read ON public.reward_point_transactions FOR SELECT
  USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin')
  );

-- Only system can insert transactions (via service role)
-- Admins can insert adjustments
DROP POLICY IF EXISTS reward_point_transactions_admin_insert ON public.reward_point_transactions;
CREATE POLICY reward_point_transactions_admin_insert ON public.reward_point_transactions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin')
  );

-- RLS for user_reward_points
ALTER TABLE public.user_reward_points ENABLE ROW LEVEL SECURITY;

-- Customers can read their own balance, admins can read all
DROP POLICY IF EXISTS user_reward_points_customer_read ON public.user_reward_points;
CREATE POLICY user_reward_points_customer_read ON public.user_reward_points FOR SELECT
  USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin')
  );

-- Only system can update balances (via service role or triggers)
-- Admins can update balances for adjustments
DROP POLICY IF EXISTS user_reward_points_admin_update ON public.user_reward_points;
CREATE POLICY user_reward_points_admin_update ON public.user_reward_points FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin')
  );

-- Function to update user reward points balance
CREATE OR REPLACE FUNCTION public.update_user_reward_points_balance()
RETURNS TRIGGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  -- Calculate new balance
  SELECT 
    COALESCE(SUM(CASE WHEN transaction_type = 'earned' THEN points ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN transaction_type IN ('used', 'expired') THEN ABS(points) ELSE 0 END), 0)
  INTO new_balance
  FROM public.reward_point_transactions
  WHERE user_id = NEW.user_id;

  -- Update or insert user_reward_points
  INSERT INTO public.user_reward_points (user_id, current_balance, updated_at, last_transaction_at)
  VALUES (NEW.user_id, new_balance, now(), now())
  ON CONFLICT (user_id) DO UPDATE
  SET 
    current_balance = new_balance,
    updated_at = now(),
    last_transaction_at = now();

  -- Update totals
  UPDATE public.user_reward_points
  SET 
    total_points_earned = (
      SELECT COALESCE(SUM(points), 0)
      FROM public.reward_point_transactions
      WHERE user_id = NEW.user_id AND transaction_type = 'earned'
    ),
    total_points_used = (
      SELECT COALESCE(SUM(ABS(points)), 0)
      FROM public.reward_point_transactions
      WHERE user_id = NEW.user_id AND transaction_type = 'used'
    ),
    total_points_expired = (
      SELECT COALESCE(SUM(ABS(points)), 0)
      FROM public.reward_point_transactions
      WHERE user_id = NEW.user_id AND transaction_type = 'expired'
    )
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update balance after transaction
DROP TRIGGER IF EXISTS trg_update_reward_points_balance ON public.reward_point_transactions;
CREATE TRIGGER trg_update_reward_points_balance
  AFTER INSERT ON public.reward_point_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_reward_points_balance();

-- Function to calculate points earned from order amount
CREATE OR REPLACE FUNCTION public.calculate_points_earned(order_amount DECIMAL)
RETURNS INTEGER AS $$
DECLARE
  points_per_dollar DECIMAL;
BEGIN
  SELECT (value->>'points_per_dollar')::DECIMAL INTO points_per_dollar
  FROM public.settings
  WHERE key = 'reward_points';

  IF points_per_dollar IS NULL THEN
    points_per_dollar := 10; -- Default
  END IF;

  RETURN FLOOR(order_amount * points_per_dollar)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate dollar value of points
CREATE OR REPLACE FUNCTION public.calculate_points_value(points INTEGER)
RETURNS DECIMAL AS $$
DECLARE
  dollars_per_point DECIMAL;
BEGIN
  SELECT (value->>'dollars_per_point')::DECIMAL INTO dollars_per_point
  FROM public.settings
  WHERE key = 'reward_points';

  IF dollars_per_point IS NULL THEN
    dollars_per_point := 0.001; -- Default: 1000 points = 1 dollar
  END IF;

  RETURN (points * dollars_per_point)::DECIMAL(10,2);
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE public.reward_point_transactions IS 'Tracks all reward point transactions (earned, used, expired, adjusted)';
COMMENT ON TABLE public.user_reward_points IS 'Denormalized table for quick access to user reward point balances';
COMMENT ON COLUMN public.orders.reward_points_used IS 'Number of reward points used for this order';
COMMENT ON COLUMN public.orders.reward_points_value IS 'Dollar value of reward points used for this order';
COMMENT ON FUNCTION public.calculate_points_earned IS 'Calculates points earned based on order amount and current settings';
COMMENT ON FUNCTION public.calculate_points_value IS 'Calculates dollar value of points based on current settings';
