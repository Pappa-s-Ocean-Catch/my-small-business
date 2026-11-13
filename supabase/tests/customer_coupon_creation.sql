-- Run against a migrated local database: psql -v ON_ERROR_STOP=1 -f <this file>
-- Exercise the actual RLS boundary used by authenticated tablet coupon inserts.
BEGIN;
INSERT INTO public.profiles (id, role_slug, full_name) VALUES
  ('00000000-0000-0000-0000-000000000301', 'admin', 'Coupon test admin'),
  ('00000000-0000-0000-0000-000000000302', 'staff', 'Coupon test staff'),
  ('00000000-0000-0000-0000-000000000303', 'customer', 'Coupon test customer');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000302', true);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.coupons (code, title, discount_type, discount_value, user_id, max_uses, max_uses_per_user)
    VALUES ('RLS-STAFF-COUPON-TEST', 'Staff forbidden', 'percent', 10, '00000000-0000-0000-0000-000000000303', 1, 1);
    RAISE EXCEPTION 'staff must not create coupons';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000303', true);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.coupons (code, title, discount_type, discount_value, user_id)
    VALUES ('RLS-CUSTOMER-COUPON-TEST', 'Customer forbidden', 'fixed', 5, '00000000-0000-0000-0000-000000000303');
    RAISE EXCEPTION 'customers must not create coupons';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
INSERT INTO public.coupons (code, title, discount_type, discount_value, user_id, max_uses, max_uses_per_user)
VALUES
  ('RLS-ADMIN-PERCENT-TEST', 'Admin percent', 'percent', 10, '00000000-0000-0000-0000-000000000303', 1, 1),
  ('RLS-ADMIN-FIXED-TEST', 'Admin fixed', 'fixed', 12.50, '00000000-0000-0000-0000-000000000303', 1, 1);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.coupons WHERE code IN ('RLS-ADMIN-PERCENT-TEST', 'RLS-ADMIN-FIXED-TEST') AND user_id = '00000000-0000-0000-0000-000000000303') <> 2 THEN
    RAISE EXCEPTION 'admin must be able to create both customer-targeted discount types';
  END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.coupons (code, title, discount_type, discount_value)
    VALUES ('RLS-ANON-COUPON-TEST', 'Anonymous forbidden', 'fixed', 5);
    RAISE EXCEPTION 'anonymous clients must not create coupons';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
ROLLBACK;
