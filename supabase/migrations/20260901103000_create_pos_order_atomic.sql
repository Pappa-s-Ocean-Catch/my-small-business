-- Persist a POS order, its items, and their add-ons in one database transaction.
-- This removes the client-side per-item request waterfall and guarantees that a
-- failed insert cannot leave a partial order behind.
CREATE OR REPLACE FUNCTION public.create_pos_order_atomic(
  p_order jsonb,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_addon jsonb;
BEGIN
  IF jsonb_typeof(p_order) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'p_order must be a JSON object';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_items must be a JSON array';
  END IF;

  INSERT INTO public.orders (
    user_id,
    receipt_claim_token,
    customer_email,
    customer_phone,
    customer_name,
    payment_method,
    order_channel,
    payment_method_detail,
    order_type,
    payment_status,
    order_status,
    subtotal,
    tax,
    delivery_fee,
    service_fee,
    promotion_discount,
    promotions_applied,
    coupon_code,
    coupon_discount,
    total,
    marketplace_gross_sales,
    marketplace_gross_payout,
    marketplace_workflow_uuid,
    reward_points_used,
    reward_points_value,
    order_options,
    special_instructions,
    delivery_address_id,
    delivery_address_line1,
    delivery_address_line2,
    delivery_city,
    delivery_state,
    delivery_postcode,
    delivery_country,
    delivery_latitude,
    delivery_longitude,
    delivery_quote_id,
    delivery_quote_amount,
    delivery_quote_currency,
    delivery_partner_name,
    external_order_number,
    delivery_quote_expires_at,
    delivery_eta_minutes,
    delivery_provider_id,
    delivery_status,
    delivery_tracking_url,
    delivery_driver_name,
    delivery_driver_phone,
    delivery_driver_pin,
    delivery_vehicle_info,
    delivery_instructions,
    scheduled_pickup_at
  )
  VALUES (
    NULLIF(p_order->>'user_id', '')::uuid,
    NULLIF(p_order->>'receipt_claim_token', ''),
    COALESCE(p_order->>'customer_email', ''),
    COALESCE(p_order->>'customer_phone', ''),
    p_order->>'customer_name',
    p_order->>'payment_method',
    p_order->>'order_channel',
    p_order->>'payment_method_detail',
    p_order->>'order_type',
    p_order->>'payment_status',
    p_order->>'order_status',
    (p_order->>'subtotal')::numeric,
    COALESCE((p_order->>'tax')::numeric, 0),
    COALESCE((p_order->>'delivery_fee')::numeric, 0),
    COALESCE((p_order->>'service_fee')::numeric, 0),
    COALESCE((p_order->>'promotion_discount')::numeric, 0),
    COALESCE(p_order->'promotions_applied', '[]'::jsonb),
    p_order->>'coupon_code',
    COALESCE((p_order->>'coupon_discount')::numeric, 0),
    (p_order->>'total')::numeric,
    NULLIF(p_order->>'marketplace_gross_sales', '')::numeric,
    NULLIF(p_order->>'marketplace_gross_payout', '')::numeric,
    p_order->>'marketplace_workflow_uuid',
    NULLIF(p_order->>'reward_points_used', '')::bigint,
    NULLIF(p_order->>'reward_points_value', '')::numeric,
    p_order->>'order_options',
    p_order->>'special_instructions',
    NULLIF(p_order->>'delivery_address_id', '')::uuid,
    p_order->>'delivery_address_line1',
    p_order->>'delivery_address_line2',
    p_order->>'delivery_city',
    p_order->>'delivery_state',
    p_order->>'delivery_postcode',
    p_order->>'delivery_country',
    NULLIF(p_order->>'delivery_latitude', '')::numeric,
    NULLIF(p_order->>'delivery_longitude', '')::numeric,
    p_order->>'delivery_quote_id',
    NULLIF(p_order->>'delivery_quote_amount', '')::numeric,
    p_order->>'delivery_quote_currency',
    p_order->>'delivery_partner_name',
    p_order->>'external_order_number',
    NULLIF(p_order->>'delivery_quote_expires_at', '')::timestamptz,
    NULLIF(p_order->>'delivery_eta_minutes', '')::integer,
    p_order->>'delivery_provider_id',
    p_order->>'delivery_status',
    p_order->>'delivery_tracking_url',
    p_order->>'delivery_driver_name',
    p_order->>'delivery_driver_phone',
    p_order->>'delivery_driver_pin',
    p_order->>'delivery_vehicle_info',
    p_order->>'delivery_instructions',
    NULLIF(p_order->>'scheduled_pickup_at', '')::timestamptz
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      product_description,
      product_image_url,
      base_price,
      override_price,
      quantity,
      subtotal,
      section,
      removed_ingredients,
      comment
    )
    VALUES (
      v_order_id,
      NULLIF(v_item->>'product_id', '')::uuid,
      v_item->>'product_name',
      v_item->>'product_description',
      v_item->>'product_image_url',
      (v_item->>'base_price')::numeric,
      NULLIF(v_item->>'override_price', '')::numeric,
      (v_item->>'quantity')::integer,
      (v_item->>'subtotal')::numeric,
      v_item->>'section',
      CASE
        WHEN jsonb_typeof(v_item->'removed_ingredients') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_item->'removed_ingredients'))
        ELSE ARRAY[]::text[]
      END,
      v_item->>'comment'
    )
    RETURNING id INTO v_item_id;

    FOR v_addon IN
      SELECT value
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(v_item->'addons') = 'array' THEN v_item->'addons'
          ELSE '[]'::jsonb
        END
      )
    LOOP
      INSERT INTO public.order_item_addons (
        order_item_id,
        addon_group_id,
        addon_group_name,
        addon_item_id,
        addon_item_name,
        addon_item_price,
        section
      )
      VALUES (
        v_item_id,
        NULLIF(v_addon->>'addon_group_id', '')::uuid,
        v_addon->>'addon_group_name',
        NULLIF(v_addon->>'addon_item_id', '')::uuid,
        v_addon->>'addon_item_name',
        (v_addon->>'addon_item_price')::numeric,
        v_addon->>'section'
      );
    END LOOP;
  END LOOP;

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_pos_order_atomic(jsonb, jsonb) TO authenticated;
