-- First-time customers often have no row in user_reward_points yet.
-- In PL/pgSQL, SELECT ... INTO sets the target to NULL when the query returns
-- zero rows, ignoring the prior initializer. That made points_balance_after NULL.

CREATE OR REPLACE FUNCTION public.ensure_reward_points_for_completed_order()
RETURNS TRIGGER AS $$
DECLARE
  reward_enabled BOOLEAN := true;
  points_per_dollar NUMERIC := 10;
  points_earned INTEGER := 0;
  current_balance INTEGER := 0;
BEGIN
  IF NEW.user_id IS NULL OR NEW.payment_status <> 'paid' OR NEW.order_status <> 'completed' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reward_point_transactions rpt
    WHERE rpt.user_id = NEW.user_id
      AND rpt.order_id = NEW.id
      AND rpt.transaction_type = 'earned'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE((s.value->>'enabled')::BOOLEAN, true),
    COALESCE((s.value->>'points_per_dollar')::NUMERIC, 10)
  INTO reward_enabled, points_per_dollar
  FROM public.settings s
  WHERE s.key = 'reward_points';

  reward_enabled := COALESCE(reward_enabled, true);
  points_per_dollar := COALESCE(points_per_dollar, 10);

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

  current_balance := COALESCE(current_balance, 0);

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
