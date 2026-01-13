-- Migration: Add rewards points system (accounts + ledger + config)

-- Rewards accounts per user
CREATE TABLE IF NOT EXISTS public.reward_accounts (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance_points BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rewards ledger to track earning/redeeming/adjustments
CREATE TABLE IF NOT EXISTS public.reward_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  delta_points BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('earn','redeem','adjust')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reward_ledger_user_id ON public.reward_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_order_id ON public.reward_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_created_at ON public.reward_ledger(created_at DESC);

-- RLS
ALTER TABLE public.reward_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_ledger ENABLE ROW LEVEL SECURITY;

-- reward_accounts policies: customers can read their own; admins can read all; admins can update
DROP POLICY IF EXISTS reward_accounts_select ON public.reward_accounts;
CREATE POLICY reward_accounts_select ON public.reward_accounts FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin'));

DROP POLICY IF EXISTS reward_accounts_admin_all ON public.reward_accounts;
CREATE POLICY reward_accounts_admin_all ON public.reward_accounts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin'));

-- reward_ledger policies: customers can read their own; admins all
DROP POLICY IF EXISTS reward_ledger_select ON public.reward_ledger;
CREATE POLICY reward_ledger_select ON public.reward_ledger FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin'));

DROP POLICY IF EXISTS reward_ledger_admin_all ON public.reward_ledger;
CREATE POLICY reward_ledger_admin_all ON public.reward_ledger FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin'));

-- Trigger to update updated_at on reward_accounts
CREATE TRIGGER trg_reward_accounts_updated_at
  BEFORE UPDATE ON public.reward_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Default reward config in settings (earn + redeem rates)
INSERT INTO public.settings (key, value)
VALUES (
  'reward_config',
  jsonb_build_object(
    'earn_points_per_dollar', 10,
    'points_per_dollar_value', 1000
  )
) ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.reward_accounts IS 'Reward point balance per user';
COMMENT ON TABLE public.reward_ledger IS 'Reward point transactions (earn/redeem/adjust)';
COMMENT ON COLUMN public.reward_ledger.delta_points IS 'Positive = earn, negative = redeem/adjust';
COMMENT ON COLUMN public.reward_ledger.balance_after IS 'Balance after this transaction';
COMMENT ON COLUMN public.settings.value IS 'Stores reward_config with earn_points_per_dollar and points_per_dollar_value';
