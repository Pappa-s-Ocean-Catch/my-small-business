-- Rewards system: balances, transactions, order reward fields, and configuration

-- 1) Reward configuration (stored in settings table as JSON)
INSERT INTO public.settings (key, value)
VALUES (
  'rewards',
  jsonb_build_object(
    'points_per_currency', 10,      -- Earn 10 points per $1 spent
    'currency_per_points', 0.001,   -- Each point worth $0.001 (1000 points = $1)
    'enabled', true
  )
)
ON CONFLICT (key) DO NOTHING;

-- 2) Reward balances
CREATE TABLE IF NOT EXISTS public.reward_balances (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  points BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Reward transactions (ledger)
CREATE TABLE IF NOT EXISTS public.reward_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  points BIGINT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'adjust', 'refund')),
  description TEXT,
  balance_after BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reward_transactions_user_id ON public.reward_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_transactions_order_id ON public.reward_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_reward_transactions_created_at ON public.reward_transactions(created_at DESC);

-- 4) Add reward fields to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS reward_points_earned BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_points_redeemed BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_value_redeemed DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rewards_enabled BOOLEAN DEFAULT true;

-- 5) RLS for reward_balances
ALTER TABLE public.reward_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reward_balances_customer_read ON public.reward_balances;
CREATE POLICY reward_balances_customer_read ON public.reward_balances
  FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role_slug = 'admin'
    )
  );

DROP POLICY IF EXISTS reward_balances_admin_all ON public.reward_balances;
CREATE POLICY reward_balances_admin_all ON public.reward_balances
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role_slug = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role_slug = 'admin')
  );

-- 6) RLS for reward_transactions
ALTER TABLE public.reward_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reward_transactions_customer_read ON public.reward_transactions;
CREATE POLICY reward_transactions_customer_read ON public.reward_transactions
  FOR SELECT USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role_slug = 'admin'
    )
  );

DROP POLICY IF EXISTS reward_transactions_admin_all ON public.reward_transactions;
CREATE POLICY reward_transactions_admin_all ON public.reward_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role_slug = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role_slug = 'admin')
  );

-- 7) Comments
COMMENT ON TABLE public.reward_balances IS 'Current reward point balances per user';
COMMENT ON TABLE public.reward_transactions IS 'Reward point ledger (earn, redeem, adjust, refund)';
COMMENT ON COLUMN public.orders.reward_points_earned IS 'Points earned from this order';
COMMENT ON COLUMN public.orders.reward_points_redeemed IS 'Points spent on this order';
COMMENT ON COLUMN public.orders.reward_value_redeemed IS 'Currency value covered by redeemed points';
