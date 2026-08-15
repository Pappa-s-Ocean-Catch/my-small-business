BEGIN;

DO $$
DECLARE
  destination_id UUID := '00000000-0000-0000-0000-000000000101';
  legacy_id UUID := '00000000-0000-0000-0000-000000000102';
  order_id UUID := '00000000-0000-0000-0000-000000000103';
  transaction_id UUID := '00000000-0000-0000-0000-000000000104';
  destination_balance_id UUID := '00000000-0000-0000-0000-000000000105';
  legacy_balance_id UUID := '00000000-0000-0000-0000-000000000106';
  admin_id UUID := '00000000-0000-0000-0000-000000000107';
  email_candidate_id UUID := '00000000-0000-0000-0000-000000000108';
  phone_candidate_id UUID := '00000000-0000-0000-0000-000000000109';
  merged_id UUID;
  actual_email TEXT;
  actual_name TEXT;
  actual_order_user UUID;
  actual_transaction_user UUID;
  actual_balance INTEGER;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role_slug)
  VALUES
    (destination_id, NULL, NULL, '+61400000001', 'customer'),
    (legacy_id, 'merge@example.invalid', 'Legacy Customer', '+61400000001', 'customer');

  INSERT INTO public.orders (
    id, order_number, user_id, customer_email, customer_phone, customer_name,
    order_type, payment_method, subtotal, tax, delivery_fee, service_fee, total
  ) VALUES (
    order_id, 'PROFILE-LINK-TEST-1', legacy_id, 'merge@example.invalid',
    '+61400000001', 'Legacy Customer', 'pickup', 'cash', 10, 0, 0, 0, 10
  );

  INSERT INTO public.reward_point_transactions (
    id, user_id, transaction_type, points, points_balance_after, description
  ) VALUES (
    transaction_id, legacy_id, 'earned', 30, 30, 'Profile linking test'
  );

  INSERT INTO public.user_reward_points (
    user_id, total_points_earned, total_points_used, total_points_expired,
    current_balance, last_transaction_at
  ) VALUES
    (destination_id, 10, 0, 0, 10, '2026-08-15T00:00:00Z'),
    (legacy_id, 30, 0, 0, 30, '2026-08-15T01:00:00Z');

  SELECT public.merge_customer_profile_into_auth_user(
    destination_id,
    'merge@example.invalid',
    '+61400000001',
    'Merged Customer'
  ) INTO merged_id;

  IF merged_id IS DISTINCT FROM legacy_id THEN
    RAISE EXCEPTION 'expected merged profile %, got %', legacy_id, merged_id;
  END IF;

  SELECT email, full_name INTO actual_email, actual_name
  FROM public.profiles
  WHERE id = destination_id;

  IF actual_email IS DISTINCT FROM 'merge@example.invalid'
     OR actual_name IS DISTINCT FROM 'Merged Customer' THEN
    RAISE EXCEPTION 'destination profile was not updated correctly';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = legacy_id) THEN
    RAISE EXCEPTION 'legacy profile still exists';
  END IF;

  SELECT user_id INTO actual_order_user FROM public.orders WHERE id = order_id;
  SELECT user_id INTO actual_transaction_user
  FROM public.reward_point_transactions
  WHERE id = transaction_id;
  SELECT current_balance INTO actual_balance
  FROM public.user_reward_points
  WHERE user_id = destination_id;

  IF actual_order_user IS DISTINCT FROM destination_id
     OR actual_transaction_user IS DISTINCT FROM destination_id
     OR actual_balance IS DISTINCT FROM 40 THEN
    RAISE EXCEPTION 'legacy customer data was not merged';
  END IF;

  INSERT INTO public.profiles (id, email, role_slug)
  VALUES (admin_id, 'admin-owner@example.invalid', 'admin');

  BEGIN
    PERFORM public.merge_customer_profile_into_auth_user(
      destination_id,
      'admin-owner@example.invalid',
      NULL,
      NULL
    );
    RAISE EXCEPTION 'expected non-customer email conflict';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN NULL;
  END;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = admin_id)
     OR (SELECT email FROM public.profiles WHERE id = destination_id)
        IS DISTINCT FROM 'merge@example.invalid' THEN
    RAISE EXCEPTION 'non-customer email conflict changed data';
  END IF;

  INSERT INTO public.profiles (id, email, phone, role_slug)
  VALUES
    (email_candidate_id, 'different@example.invalid', '+61400000002', 'customer'),
    (phone_candidate_id, 'phone@example.invalid', '+61400000003', 'customer');

  BEGIN
    PERFORM public.merge_customer_profile_into_auth_user(
      destination_id,
      'different@example.invalid',
      '+61400000003',
      NULL
    );
    RAISE EXCEPTION 'expected ambiguous customer profile conflict';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN NULL;
  END;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = email_candidate_id)
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = phone_candidate_id) THEN
    RAISE EXCEPTION 'ambiguous customer conflict changed data';
  END IF;
END $$;

ROLLBACK;
