-- Create a view for customer summary to support efficient pagination and search
DROP VIEW IF EXISTS public.customer_summary CASCADE;
CREATE VIEW public.customer_summary AS
WITH customer_stats AS (
  SELECT 
    customer_email,
    customer_phone,
    MIN(customer_name) as name,
    MIN(created_at) as first_order_date,
    MAX(created_at) as last_order_date,
    COUNT(*) as "totalOrders",
    COALESCE(SUM(total), 0) as "totalSpent",
    MAX(user_id::text)::uuid as "lastUserId"
  FROM public.orders
  GROUP BY customer_email, customer_phone
),
customer_with_profile AS (
  SELECT 
    cs.*,
    COALESCE(
      cs."lastUserId",
      (SELECT p.id FROM public.profiles p WHERE (p.email = cs.customer_email AND cs.customer_email IS NOT NULL AND cs.customer_email != '') LIMIT 1),
      (SELECT p.id FROM public.profiles p WHERE (p.phone = cs.customer_phone AND cs.customer_phone IS NOT NULL AND cs.customer_phone != '') LIMIT 1)
    ) as "foundProfileId"
  FROM customer_stats cs
)
SELECT 
  cp.name,
  cp.customer_email as email,
  cp.customer_phone as phone,
  cp.first_order_date as "firstOrderDate",
  cp.last_order_date as "lastOrderDate",
  cp."totalOrders",
  cp."totalSpent"::FLOAT as "totalSpent",
  COALESCE(urp.current_balance, 0)::INTEGER as "rewardPoints"
FROM customer_with_profile cp
LEFT JOIN public.user_reward_points urp ON urp.user_id = cp."foundProfileId";

-- Grant access to the view
GRANT SELECT ON public.customer_summary TO authenticated;
GRANT SELECT ON public.customer_summary TO service_role;

-- Add comment for documentation
COMMENT ON VIEW public.customer_summary IS 'Aggregated customer statistics derived from the orders table';
