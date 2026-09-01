-- Forward-only marketplace customer identity. Marketplace relay/driver phones and
-- external order numbers are not customer contact details and must not be used as
-- a customer key.

CREATE TABLE IF NOT EXISTS public.marketplace_customer_profiles (
  provider TEXT NOT NULL CHECK (provider IN ('uber_eats', 'doordash')),
  external_customer_id TEXT NOT NULL CHECK (BTRIM(external_customer_id) <> ''),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, external_customer_id),
  UNIQUE (profile_id)
);

ALTER TABLE public.marketplace_customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.resolve_marketplace_customer(
  p_provider TEXT,
  p_external_customer_id TEXT,
  p_full_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_provider TEXT := NULLIF(BTRIM(p_provider), '');
  normalized_external_customer_id TEXT := NULLIF(BTRIM(p_external_customer_id), '');
  normalized_full_name TEXT := NULLIF(BTRIM(p_full_name), '');
  resolved_profile_id UUID;
BEGIN
  IF COALESCE(public.current_profile_role(), '') NOT IN ('staff', 'admin') THEN
    RAISE EXCEPTION 'Only POS staff or admins can resolve marketplace customers.' USING ERRCODE = '42501';
  END IF;

  IF normalized_provider NOT IN ('uber_eats', 'doordash') OR normalized_external_customer_id IS NULL THEN
    RAISE EXCEPTION 'A supported marketplace provider and customer ID are required.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(normalized_provider || ':' || normalized_external_customer_id, 0));

  SELECT profile_id
  INTO resolved_profile_id
  FROM public.marketplace_customer_profiles
  WHERE provider = normalized_provider
    AND external_customer_id = normalized_external_customer_id;

  IF resolved_profile_id IS NOT NULL THEN
    RETURN resolved_profile_id;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, phone, role_slug)
  VALUES (gen_random_uuid(), normalized_full_name, NULL, NULL, 'customer')
  RETURNING id INTO resolved_profile_id;

  INSERT INTO public.marketplace_customer_profiles (provider, external_customer_id, profile_id)
  VALUES (normalized_provider, normalized_external_customer_id, resolved_profile_id);

  RETURN resolved_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_marketplace_customer(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_marketplace_customer(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- Preserve existing customer grouping where contact information is available.
-- New marketplace orders group by their linked profile instead, while an
-- unlinked/no-contact order remains an individual row rather than collapsing
-- every marketplace customer into one blank-contact customer.
DROP VIEW IF EXISTS public.customer_summary CASCADE;
CREATE VIEW public.customer_summary AS
WITH customer_stats AS (
  SELECT
    MIN(customer_email) AS customer_email,
    MIN(customer_phone) AS customer_phone,
    MIN(customer_name) AS name,
    MIN(created_at) AS first_order_date,
    MAX(created_at) AS last_order_date,
    COUNT(*) AS "totalOrders",
    COALESCE(SUM(total), 0) AS "totalSpent",
    MAX(user_id::text)::uuid AS "lastUserId"
  FROM public.orders
  GROUP BY CASE
    WHEN user_id IS NOT NULL THEN 'profile:' || user_id::text
    WHEN NULLIF(LOWER(BTRIM(customer_email)), '') IS NOT NULL THEN 'email:' || LOWER(BTRIM(customer_email))
    WHEN NULLIF(BTRIM(customer_phone), '') IS NOT NULL THEN 'phone:' || BTRIM(customer_phone)
    ELSE 'order:' || id::text
  END
),
customer_with_profile AS (
  SELECT
    cs.*,
    COALESCE(
      cs."lastUserId",
      (SELECT p.id FROM public.profiles p WHERE p.email = cs.customer_email AND NULLIF(cs.customer_email, '') IS NOT NULL LIMIT 1),
      (SELECT p.id FROM public.profiles p WHERE p.phone = cs.customer_phone AND NULLIF(cs.customer_phone, '') IS NOT NULL LIMIT 1)
    ) AS "foundProfileId"
  FROM customer_stats cs
)
SELECT
  cp."foundProfileId" AS id,
  cp.name,
  cp.customer_email AS email,
  cp.customer_phone AS phone,
  cp.first_order_date AS "firstOrderDate",
  cp.last_order_date AS "lastOrderDate",
  cp."totalOrders",
  cp."totalSpent"::FLOAT AS "totalSpent",
  COALESCE(urp.current_balance, 0)::INTEGER AS "rewardPoints",
  cp."foundProfileId" AS "profileId",
  p.last_marketing_email_sent_at AS "lastMarketingEmailSentAt",
  p.last_marketing_sms_sent_at AS "lastMarketingSmsSentAt",
  p.opt_in_marketing AS "optInMarketing"
FROM customer_with_profile cp
LEFT JOIN public.user_reward_points urp ON urp.user_id = cp."foundProfileId"
LEFT JOIN public.profiles p ON p.id = cp."foundProfileId";

GRANT SELECT ON public.customer_summary TO authenticated, service_role;

COMMENT ON TABLE public.marketplace_customer_profiles IS
  'Provider-scoped stable marketplace customer identities linked to local customer profiles.';
COMMENT ON VIEW public.customer_summary IS
  'Aggregated customer statistics derived from orders, preferring linked profiles over contact fields.';
