-- Create a view for customer summary to support efficient pagination and search
DROP VIEW IF EXISTS public.customer_summary CASCADE;
CREATE VIEW public.customer_summary AS
WITH customer_stats AS (
  SELECT 
    customer_email,
    customer_phone,
    MIN(customer_name) as name, -- Take the first name encountered (usually same)
    MIN(created_at) as first_order_date,
    MAX(created_at) as last_order_date,
    COUNT(*) as "totalOrders",
    COALESCE(SUM(total), 0) as "totalSpent"
  FROM public.orders
  GROUP BY customer_email, customer_phone
)
SELECT 
  name,
  customer_email as email,
  customer_phone as phone,
  first_order_date as "firstOrderDate",
  last_order_date as "lastOrderDate",
  "totalOrders",
  "totalSpent"::FLOAT as "totalSpent"
FROM customer_stats;

-- Grant access to the view
GRANT SELECT ON public.customer_summary TO authenticated;
GRANT SELECT ON public.customer_summary TO service_role;

-- Add comment for documentation
COMMENT ON VIEW public.customer_summary IS 'Aggregated customer statistics derived from the orders table';
