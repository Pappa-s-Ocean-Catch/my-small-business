-- Add function to get product purchase analytics
CREATE OR REPLACE FUNCTION public.get_product_purchase_analytics(p_product_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
    total_purchases INTEGER;
    total_quantity INTEGER;
    average_order_size NUMERIC;
    last_purchase_date TIMESTAMPTZ;
    purchase_frequency_days INTEGER;
    monthly_trends JSON;
BEGIN
    -- Get basic purchase statistics
    SELECT 
        COUNT(*) as total_purchases,
        COALESCE(SUM(ABS(quantity_change)), 0) as total_quantity,
        COALESCE(AVG(ABS(quantity_change)), 0) as average_order_size,
        MAX(created_at) as last_purchase_date
    INTO total_purchases, total_quantity, average_order_size, last_purchase_date
    FROM public.inventory_movements
    WHERE product_id = p_product_id 
    AND movement_type = 'received'
    AND quantity_change > 0;

    -- Calculate purchase frequency (average days between purchases)
    SELECT COALESCE(AVG(days_between), 0)::INTEGER
    INTO purchase_frequency_days
    FROM (
        SELECT EXTRACT(DAYS FROM (created_at - LAG(created_at) OVER (ORDER BY created_at))) as days_between
        FROM public.inventory_movements
        WHERE product_id = p_product_id 
        AND movement_type = 'received'
        AND quantity_change > 0
        ORDER BY created_at
    ) as frequency_calc
    WHERE days_between IS NOT NULL;

    -- Get monthly trends for the last 12 months
    SELECT json_agg(
        json_build_object(
            'month', month_year,
            'quantity', total_quantity,
            'orders', order_count
        ) ORDER BY month_year
    )
    INTO monthly_trends
    FROM (
        SELECT 
            TO_CHAR(created_at, 'YYYY-MM') as month_year,
            SUM(ABS(quantity_change)) as total_quantity,
            COUNT(*) as order_count
        FROM public.inventory_movements
        WHERE product_id = p_product_id 
        AND movement_type = 'received'
        AND quantity_change > 0
        AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month_year
    ) as monthly_data;

    -- Build the result JSON
    result := json_build_object(
        'total_purchases', COALESCE(total_purchases, 0),
        'total_quantity', COALESCE(total_quantity, 0),
        'average_order_size', COALESCE(average_order_size, 0),
        'last_purchase_date', last_purchase_date,
        'purchase_frequency_days', COALESCE(purchase_frequency_days, 0),
        'monthly_trends', COALESCE(monthly_trends, '[]'::json)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_product_purchase_analytics(UUID) TO authenticated;
