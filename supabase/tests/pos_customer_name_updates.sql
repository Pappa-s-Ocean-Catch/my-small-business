-- Run against a migrated local database using psql -v ON_ERROR_STOP=1 -f <this file>
-- Fixtures and edits are rolled back.
BEGIN;

INSERT INTO public.profiles (id, role_slug, full_name, phone) VALUES
  ('00000000-0000-0000-0000-000000000201', 'staff', 'POS test staff', NULL),
  ('00000000-0000-0000-0000-000000000202', 'admin', 'POS test admin', NULL),
  ('00000000-0000-0000-0000-000000000203', 'customer', 'Unknown', '+61400000203'),
  ('00000000-0000-0000-0000-000000000204', 'customer', 'Other customer', NULL);

INSERT INTO public.orders (
  id, order_number, user_id, customer_phone, customer_name,
  order_type, payment_method, subtotal, tax, delivery_fee, service_fee, total
) VALUES (
  '00000000-0000-0000-0000-000000000205', 'POS-NAME-TEST',
  '00000000-0000-0000-0000-000000000203', '+61400000203', 'Unknown',
  'pickup', 'cash', 10, 0, 0, 0, 10
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);

DO $$
DECLARE
  changed integer;
  refreshed_name text;
BEGIN
  UPDATE public.profiles SET full_name = 'Alice'
  WHERE id = '00000000-0000-0000-0000-000000000203';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN
    RAISE EXCEPTION 'staff customer edit must persist, updated % rows', changed;
  END IF;

  SELECT name INTO refreshed_name FROM public.customer_summary
  WHERE "profileId" = '00000000-0000-0000-0000-000000000203';
  IF refreshed_name IS DISTINCT FROM 'Alice' THEN
    RAISE EXCEPTION 'refresh must show saved name, got %', refreshed_name;
  END IF;

  UPDATE public.profiles SET full_name = 'Unauthorized edit'
  WHERE id = '00000000-0000-0000-0000-000000000202';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN
    RAISE EXCEPTION 'staff must not edit another admin profile';
  END IF;

  BEGIN
    UPDATE public.profiles SET role_slug = 'admin'
    WHERE id = '00000000-0000-0000-0000-000000000203';
    RAISE EXCEPTION 'staff must not promote a customer';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
DO $$
DECLARE changed integer;
BEGIN
  UPDATE public.profiles SET full_name = 'Alice Updated'
  WHERE id = '00000000-0000-0000-0000-000000000203';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN
    RAISE EXCEPTION 'admin customer edit must persist';
  END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000204', true);
DO $$
DECLARE changed integer;
BEGIN
  UPDATE public.profiles SET full_name = 'Unauthorized edit'
  WHERE id = '00000000-0000-0000-0000-000000000203';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN
    RAISE EXCEPTION 'customers must not edit another customer';
  END IF;
END $$;

RESET ROLE;
ROLLBACK;
