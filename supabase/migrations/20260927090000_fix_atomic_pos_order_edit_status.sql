-- The POS edit client can supply a workflow status (for example, settling a
-- cancelled SmartPay order as confirmed). The original atomic update function
-- omitted this field, leaving otherwise-paid orders hidden as
-- pending_online_payment.
CREATE OR REPLACE FUNCTION public.save_pos_order_atomic(
  p_order_id uuid, p_order jsonb, p_items jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
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

  IF p_order_id IS NULL THEN
    v_order_id := public.create_pos_order_atomic(p_order, p_items);
  ELSE
    UPDATE public.orders o SET
      subtotal = (p_order->>'subtotal')::numeric,
      tax = (p_order->>'tax')::numeric,
      total = (p_order->>'total')::numeric,
      user_id = CASE WHEN p_order ? 'user_id' THEN NULLIF(p_order->>'user_id', '')::uuid ELSE o.user_id END,
      customer_phone = CASE WHEN p_order ? 'customer_phone' THEN p_order->>'customer_phone' ELSE o.customer_phone END,
      customer_name = CASE WHEN p_order ? 'customer_name' THEN p_order->>'customer_name' ELSE o.customer_name END,
      payment_method = CASE WHEN p_order ? 'payment_method' THEN p_order->>'payment_method' ELSE o.payment_method END,
      order_channel = CASE WHEN p_order ? 'order_channel' THEN p_order->>'order_channel' ELSE o.order_channel END,
      payment_status = CASE WHEN p_order ? 'payment_status' THEN p_order->>'payment_status' ELSE o.payment_status END,
      order_status = CASE WHEN p_order ? 'order_status' THEN p_order->>'order_status' ELSE o.order_status END,
      payment_method_detail = CASE WHEN p_order ? 'payment_method_detail' THEN p_order->>'payment_method_detail' ELSE o.payment_method_detail END,
      order_options = CASE WHEN p_order ? 'order_options' THEN p_order->>'order_options' ELSE o.order_options END,
      special_instructions = CASE WHEN p_order ? 'special_instructions' THEN p_order->>'special_instructions' ELSE o.special_instructions END,
      scheduled_pickup_at = CASE WHEN p_order ? 'scheduled_pickup_at' THEN NULLIF(p_order->>'scheduled_pickup_at', '')::timestamptz ELSE o.scheduled_pickup_at END,
      promotion_discount = CASE WHEN p_order ? 'promotion_discount' THEN (p_order->>'promotion_discount')::numeric ELSE o.promotion_discount END,
      promotions_applied = CASE WHEN p_order ? 'promotions_applied' THEN p_order->'promotions_applied' ELSE o.promotions_applied END,
      coupon_code = CASE WHEN p_order ? 'coupon_code' THEN p_order->>'coupon_code' ELSE o.coupon_code END,
      coupon_discount = CASE WHEN p_order ? 'coupon_discount' THEN (p_order->>'coupon_discount')::numeric ELSE o.coupon_discount END,
      reward_points_used = CASE WHEN p_order ? 'reward_points_used' THEN NULLIF(p_order->>'reward_points_used', '')::bigint ELSE o.reward_points_used END,
      reward_points_value = CASE WHEN p_order ? 'reward_points_value' THEN NULLIF(p_order->>'reward_points_value', '')::numeric ELSE o.reward_points_value END,
      updated_at = now()
    WHERE o.id = p_order_id
    RETURNING o.id INTO v_order_id;

    IF v_order_id IS NULL THEN RAISE EXCEPTION 'Order not found: %', p_order_id; END IF;

    DELETE FROM public.order_items WHERE order_id = v_order_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
      INSERT INTO public.order_items (
        order_id, product_id, product_name, product_description, product_image_url,
        base_price, override_price, quantity, subtotal, section, removed_ingredients, comment
      ) VALUES (
        v_order_id, NULLIF(v_item->>'product_id', '')::uuid, v_item->>'product_name',
        v_item->>'product_description', v_item->>'product_image_url',
        (v_item->>'base_price')::numeric, NULLIF(v_item->>'override_price', '')::numeric,
        (v_item->>'quantity')::integer, (v_item->>'subtotal')::numeric, v_item->>'section',
        CASE WHEN jsonb_typeof(v_item->'removed_ingredients') = 'array'
          THEN ARRAY(SELECT jsonb_array_elements_text(v_item->'removed_ingredients'))
          ELSE ARRAY[]::text[] END,
        v_item->>'comment'
      ) RETURNING id INTO v_item_id;

      FOR v_addon IN SELECT value FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_item->'addons') = 'array' THEN v_item->'addons' ELSE '[]'::jsonb END
      ) LOOP
        INSERT INTO public.order_item_addons (
          order_item_id, addon_group_id, addon_group_name, addon_item_id,
          addon_item_name, addon_item_price, section
        ) VALUES (
          v_item_id, NULLIF(v_addon->>'addon_group_id', '')::uuid,
          v_addon->>'addon_group_name', NULLIF(v_addon->>'addon_item_id', '')::uuid,
          v_addon->>'addon_item_name', (v_addon->>'addon_item_price')::numeric,
          v_addon->>'section'
        );
      END LOOP;
    END LOOP;
  END IF;

  RETURN public.get_pos_order_json(v_order_id);
END;
$$;

-- Repair only the impossible state caused by the missing update assignment.
-- Genuine in-progress SmartPay orders remain pending and untouched.
UPDATE public.orders
SET order_status = 'confirmed', updated_at = now()
WHERE order_status = 'pending_online_payment'
  AND payment_status = 'paid';

GRANT EXECUTE ON FUNCTION public.save_pos_order_atomic(uuid, jsonb, jsonb) TO authenticated;
