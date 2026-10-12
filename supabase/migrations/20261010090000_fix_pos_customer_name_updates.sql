-- Staff/admin may edit customer profiles, but cannot change their role or edit
-- other staff/admin profiles through this policy.
GRANT UPDATE (full_name) ON public.profiles TO authenticated;

CREATE POLICY profiles_staff_admin_update_customer
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.current_profile_role() IN ('staff', 'admin')
  AND role_slug = 'customer'
)
WITH CHECK (
  public.current_profile_role() IN ('staff', 'admin')
  AND role_slug = 'customer'
);

-- Use the editable profile name for directory/search results. Keep historical
-- order snapshots and existing identity grouping intact.
CREATE OR REPLACE VIEW public.customer_summary AS
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
    WHEN order_channel = 'instore'
      AND UPPER(BTRIM(customer_name)) = 'INSTORE' THEN 'anonymous:instore'
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
  COALESCE(NULLIF(BTRIM(p.full_name), ''), cp.name) AS name,
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

COMMENT ON VIEW public.customer_summary IS
  'Aggregated customer statistics preferring profiles and contacts, with one shared anonymous INSTORE customer.';
