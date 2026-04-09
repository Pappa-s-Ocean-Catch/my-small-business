-- Ensure reward points are allocated when paid orders are completed.
-- This covers updates from any client (web/mobile) and prevents duplicate earn transactions.

CREATE OR REPLACE FUNCTION public.ensure_reward_points_for_completed_order()
RETURNS TRIGGER AS $$
DECLARE
  reward_enabled BOOLEAN := true;
  points_per_dollar NUMERIC := 10;
  points_earned INTEGER := 0;
  current_balance INTEGER := 0;
BEGIN
  -- Only process paid, completed orders with a customer account.
  IF NEW.user_id IS NULL OR NEW.payment_status <> 'paid' OR NEW.order_status <> 'completed' THEN
    RETURN NEW;
  END IF;

  -- Prevent duplicate earned transactions for the same order.
  IF EXISTS (
    SELECT 1
    FROM public.reward_point_transactions rpt
    WHERE rpt.user_id = NEW.user_id
      AND rpt.order_id = NEW.id
      AND rpt.transaction_type = 'earned'
  ) THEN
    RETURN NEW;
  END IF;

  -- Load reward settings.
  SELECT
    COALESCE((s.value->>'enabled')::BOOLEAN, true),
    COALESCE((s.value->>'points_per_dollar')::NUMERIC, 10)
  INTO reward_enabled, points_per_dollar
  FROM public.settings s
  WHERE s.key = 'reward_points';

  IF reward_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  points_earned := FLOOR(COALESCE(NEW.subtotal, 0)::NUMERIC * points_per_dollar)::INTEGER;
  IF points_earned <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(urp.current_balance, 0)
  INTO current_balance
  FROM public.user_reward_points urp
  WHERE urp.user_id = NEW.user_id;

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
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ensure_reward_points_for_completed_order ON public.orders;
CREATE TRIGGER trg_ensure_reward_points_for_completed_order
  AFTER UPDATE OF order_status, payment_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_reward_points_for_completed_order();

