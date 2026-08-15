CREATE OR REPLACE FUNCTION public.merge_customer_profile_into_auth_user(
  p_user_id UUID,
  p_email TEXT,
  p_phone TEXT,
  p_full_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email TEXT := NULLIF(LOWER(BTRIM(p_email)), '');
  normalized_phone TEXT := NULLIF(BTRIM(p_phone), '');
  normalized_full_name TEXT := NULLIF(BTRIM(p_full_name), '');
  destination_profile public.profiles%ROWTYPE;
  legacy_profile public.profiles%ROWTYPE;
  candidate_ids UUID[];
  legacy_id UUID;
  destination_points public.user_reward_points%ROWTYPE;
  legacy_points public.user_reward_points%ROWTYPE;
BEGIN
  SELECT *
  INTO destination_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Destination customer profile was not found.' USING ERRCODE = 'P0001';
  END IF;

  IF normalized_email IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE email = normalized_email
      AND id <> p_user_id
      AND role_slug <> 'customer'
  ) THEN
    RAISE EXCEPTION 'Email belongs to a staff or admin account.' USING ERRCODE = 'P0001';
  END IF;

  SELECT ARRAY_AGG(id)
  INTO candidate_ids
  FROM (
    SELECT id
    FROM public.profiles
    WHERE id <> p_user_id
      AND role_slug = 'customer'
      AND (
        (normalized_email IS NOT NULL AND email = normalized_email)
        OR (normalized_phone IS NOT NULL AND phone = normalized_phone)
      )
    FOR UPDATE
  ) AS candidates;

  IF COALESCE(CARDINALITY(candidate_ids), 0) > 1 THEN
    RAISE EXCEPTION 'Email and phone match different customer profiles.' USING ERRCODE = 'P0001';
  END IF;

  legacy_id := candidate_ids[1];

  IF legacy_id IS NOT NULL THEN
    SELECT *
    INTO legacy_profile
    FROM public.profiles
    WHERE id = legacy_id;

    UPDATE public.orders
    SET user_id = p_user_id
    WHERE user_id = legacy_id;

    UPDATE public.reward_point_transactions
    SET user_id = p_user_id
    WHERE user_id = legacy_id;

    SELECT *
    INTO destination_points
    FROM public.user_reward_points
    WHERE user_id = p_user_id
    FOR UPDATE;

    SELECT *
    INTO legacy_points
    FROM public.user_reward_points
    WHERE user_id = legacy_id
    FOR UPDATE;

    INSERT INTO public.user_reward_points (
      user_id,
      total_points_earned,
      total_points_used,
      total_points_expired,
      current_balance,
      last_transaction_at,
      updated_at
    ) VALUES (
      p_user_id,
      COALESCE(destination_points.total_points_earned, 0) + COALESCE(legacy_points.total_points_earned, 0),
      COALESCE(destination_points.total_points_used, 0) + COALESCE(legacy_points.total_points_used, 0),
      COALESCE(destination_points.total_points_expired, 0) + COALESCE(legacy_points.total_points_expired, 0),
      COALESCE(destination_points.current_balance, 0) + COALESCE(legacy_points.current_balance, 0),
      GREATEST(destination_points.last_transaction_at, legacy_points.last_transaction_at),
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      total_points_earned = EXCLUDED.total_points_earned,
      total_points_used = EXCLUDED.total_points_used,
      total_points_expired = EXCLUDED.total_points_expired,
      current_balance = EXCLUDED.current_balance,
      last_transaction_at = EXCLUDED.last_transaction_at,
      updated_at = EXCLUDED.updated_at;

    DELETE FROM public.user_reward_points WHERE user_id = legacy_id;
    DELETE FROM public.profiles WHERE id = legacy_id;
  END IF;

  UPDATE public.profiles
  SET
    role_slug = 'customer',
    full_name = COALESCE(normalized_full_name, legacy_profile.full_name, destination_profile.full_name),
    email = COALESCE(normalized_email, legacy_profile.email, destination_profile.email),
    phone = COALESCE(normalized_phone, legacy_profile.phone, destination_profile.phone)
  WHERE id = p_user_id;

  RETURN legacy_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_customer_profile_into_auth_user(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_customer_profile_into_auth_user(UUID, TEXT, TEXT, TEXT)
  TO service_role;
