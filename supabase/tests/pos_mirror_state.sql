BEGIN;

SELECT plan(16);

SELECT has_table('public', 'pos_mirror_state');
SELECT col_is_pk('public', 'pos_mirror_state', 'register_id');
SELECT col_type_is('public', 'pos_mirror_state', 'current_order', 'jsonb');

INSERT INTO public.profiles (id, email, role_slug)
VALUES
  ('00000000-0000-0000-0000-000000000201', 'pos-mirror-staff@example.invalid', 'staff'),
  ('00000000-0000-0000-0000-000000000202', 'pos-mirror-admin@example.invalid', 'admin'),
  ('00000000-0000-0000-0000-000000000203', 'pos-mirror-customer@example.invalid', 'customer');

DO $$
DECLARE
  user_id UUID := '00000000-0000-0000-0000-000000000201';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', user_id::text, true);
END $$;

SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    INSERT INTO public.pos_mirror_state (register_id)
    VALUES ('test-register')
    ON CONFLICT (register_id) DO UPDATE
    SET current_order = EXCLUDED.current_order
  $$,
  'staff can insert with upsert'
);

SELECT is((SELECT current_order FROM public.pos_mirror_state WHERE register_id = 'test-register'), '{}'::jsonb);

SELECT lives_ok(
  $$
    INSERT INTO public.pos_mirror_state (register_id, register_name, current_order)
    VALUES ('test-register', 'Test Register', '{"actor":"staff"}'::jsonb)
    ON CONFLICT (register_id) DO UPDATE
    SET current_order = EXCLUDED.current_order
  $$,
  'staff can update with upsert'
);

SELECT is(
  (SELECT current_order FROM public.pos_mirror_state WHERE register_id = 'test-register'),
  '{"actor":"staff"}'::jsonb,
  'staff can select mirror state'
);

DELETE FROM public.pos_mirror_state
WHERE register_id = 'test-register';

SELECT is(
  (SELECT count(*) FROM public.pos_mirror_state WHERE register_id = 'test-register'),
  1::bigint,
  'staff cannot delete mirror state'
);

RESET ROLE;

DO $$
DECLARE
  user_id UUID := '00000000-0000-0000-0000-000000000202';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', user_id::text, true);
END $$;

SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    INSERT INTO public.pos_mirror_state (register_id)
    VALUES ('admin-register')
    ON CONFLICT (register_id) DO UPDATE
    SET current_order = EXCLUDED.current_order
  $$,
  'admin can insert with upsert'
);

SELECT lives_ok(
  $$
    INSERT INTO public.pos_mirror_state (register_id, current_order)
    VALUES ('admin-register', '{"actor":"admin"}'::jsonb)
    ON CONFLICT (register_id) DO UPDATE
    SET current_order = EXCLUDED.current_order
  $$,
  'admin can update with upsert'
);

SELECT is(
  (SELECT current_order FROM public.pos_mirror_state WHERE register_id = 'admin-register'),
  '{"actor":"admin"}'::jsonb,
  'admin can select mirror state'
);

SELECT is(
  (SELECT count(*) FROM public.order_sync_state WHERE singleton),
  1::bigint,
  'admin can select order sync state'
);

RESET ROLE;

DO $$
DECLARE
  user_id UUID := '00000000-0000-0000-0000-000000000203';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', user_id::text, true);
END $$;

SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT count(*) FROM public.pos_mirror_state),
  0::bigint,
  'customer cannot select mirror state'
);

SELECT throws_ok(
  $$
    INSERT INTO public.pos_mirror_state (register_id, current_order)
    VALUES ('customer-register', '{"actor":"customer"}'::jsonb)
    ON CONFLICT (register_id) DO UPDATE
    SET current_order = EXCLUDED.current_order
  $$,
  '42501',
  'new row violates row-level security policy for table "pos_mirror_state"',
  'customer cannot upsert mirror state'
);

SELECT is(
  (SELECT count(*) FROM public.order_sync_state WHERE singleton),
  0::bigint,
  'customer cannot select order sync state'
);

RESET ROLE;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pos_mirror_state'
  ),
  'pos_mirror_state is in the Supabase Realtime publication'
);

SELECT * FROM finish();

ROLLBACK;
