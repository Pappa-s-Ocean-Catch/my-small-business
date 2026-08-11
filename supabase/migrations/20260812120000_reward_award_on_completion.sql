-- Reward points are awarded by the database when an eligible paid customer
-- order transitions to completed. Receipt claims retain their separate,
-- intentional reward flow and are protected by the same unique index.

-- Keep the earliest earned transaction for each order and discard only later
-- duplicates. created_at plus id provides a deterministic tie breaker.
WITH ranked_earned_transactions AS (
  SELECT
    id,
    user_id,
    ROW_NUMBER() OVER (
      PARTITION BY order_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS duplicate_rank
  FROM public.reward_point_transactions
  WHERE transaction_type = 'earned'
    AND order_id IS NOT NULL
),
deleted_duplicates AS (
  DELETE FROM public.reward_point_transactions AS transactions
  USING ranked_earned_transactions AS ranked
  WHERE transactions.id = ranked.id
    AND ranked.duplicate_rank > 1
  RETURNING transactions.user_id
),
affected_users AS (
  SELECT DISTINCT user_id
  FROM deleted_duplicates
)
UPDATE public.user_reward_points AS balances
SET
  total_points_earned = COALESCE((
    SELECT SUM(transactions.points)::INTEGER
    FROM public.reward_point_transactions AS transactions
    WHERE transactions.user_id = balances.user_id
      AND transactions.transaction_type = 'earned'
  ), 0),
  total_points_used = COALESCE((
    SELECT SUM(ABS(transactions.points))::INTEGER
    FROM public.reward_point_transactions AS transactions
    WHERE transactions.user_id = balances.user_id
      AND transactions.transaction_type = 'used'
  ), 0),
  total_points_expired = COALESCE((
    SELECT SUM(ABS(transactions.points))::INTEGER
    FROM public.reward_point_transactions AS transactions
    WHERE transactions.user_id = balances.user_id
      AND transactions.transaction_type = 'expired'
  ), 0),
  current_balance = COALESCE((
    SELECT SUM(
      CASE
        WHEN transactions.transaction_type = 'earned' THEN transactions.points
        WHEN transactions.transaction_type IN ('used', 'expired') THEN -ABS(transactions.points)
        ELSE 0
      END
    )::INTEGER
    FROM public.reward_point_transactions AS transactions
    WHERE transactions.user_id = balances.user_id
  ), 0),
  last_transaction_at = (
    SELECT MAX(transactions.created_at)
    FROM public.reward_point_transactions AS transactions
    WHERE transactions.user_id = balances.user_id
  ),
  updated_at = now()
WHERE balances.user_id IN (SELECT user_id FROM affected_users);

-- This is the final idempotency boundary for every reward-award path.
CREATE UNIQUE INDEX IF NOT EXISTS reward_point_transactions_one_earned_per_order
  ON public.reward_point_transactions (order_id)
  WHERE transaction_type = 'earned'
    AND order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_reward_points_for_completed_order()
RETURNS TRIGGER AS $$
DECLARE
  reward_enabled BOOLEAN := true;
  points_per_dollar NUMERIC := 10;
  points_earned INTEGER := 0;
  current_balance INTEGER := 0;
BEGIN
  -- Award only once as an order enters completed. This excludes later edits to
  -- an already-completed order and leaves receipt claims untouched because they
  -- do not update an order-status column.
  IF OLD.order_status IS NOT DISTINCT FROM 'completed'
    OR NEW.order_status IS DISTINCT FROM 'completed'
    OR NEW.payment_status IS DISTINCT FROM 'paid'
    OR NEW.order_channel IS NOT DISTINCT FROM 'third_party'
    OR NEW.user_id IS NULL
  THEN
    RETURN NEW;
  END IF;

  -- A linked profile must be a real customer account. This rejects staff,
  -- admin, and virtual INSTORE orders without relying on display names.
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = NEW.user_id
      AND profile.role_slug = 'customer'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE((settings.value->>'enabled')::BOOLEAN, true),
    COALESCE((settings.value->>'points_per_dollar')::NUMERIC, 10)
  INTO reward_enabled, points_per_dollar
  FROM public.settings AS settings
  WHERE settings.key = 'reward_points';

  reward_enabled := COALESCE(reward_enabled, true);
  points_per_dollar := COALESCE(points_per_dollar, 10);

  IF reward_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  points_earned := FLOOR(COALESCE(NEW.subtotal, 0)::NUMERIC * points_per_dollar)::INTEGER;
  IF points_earned <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(balances.current_balance, 0)
  INTO current_balance
  FROM public.user_reward_points AS balances
  WHERE balances.user_id = NEW.user_id;

  current_balance := COALESCE(current_balance, 0);

  -- A concurrent claim or retry must never fail the POS completion update.
  INSERT INTO public.reward_point_transactions (
    user_id,
    order_id,
    transaction_type,
    points,
    points_balance_after,
    description,
    metadata
  )
  VALUES (
    NEW.user_id,
    NEW.id,
    'earned',
    points_earned,
    current_balance + points_earned,
    'Earned reward points when order completed',
    jsonb_build_object(
      'food_subtotal', COALESCE(NEW.subtotal, 0),
      'points_per_dollar', points_per_dollar,
      'source', 'orders_completion_trigger'
    )
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
