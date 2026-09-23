-- Existing clients continue to use create_pos_order_atomic(jsonb, jsonb).
-- This migration adds an atomic replacement path and publishes catalogue edits.

CREATE OR REPLACE FUNCTION public.get_pos_order_json(p_order_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT to_jsonb(o) || jsonb_build_object('order_items', COALESCE((
    SELECT jsonb_agg(to_jsonb(oi) || jsonb_build_object('order_item_addons', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at, a.id)
      FROM public.order_item_addons a WHERE a.order_item_id = oi.id
    ), '[]'::jsonb)) ORDER BY oi.created_at, oi.id)
    FROM public.order_items oi WHERE oi.order_id = o.id
  ), '[]'::jsonb))
  FROM public.orders o WHERE o.id = p_order_id;
$$;

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

    -- The add-on foreign key cascades. If any subsequent insert fails, PostgreSQL
    -- rolls the header update and this deletion back with the whole RPC.
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

CREATE OR REPLACE FUNCTION public.update_pos_payment_status_atomic(
  p_order_id uuid, p_payment_status text, p_payment_method_detail text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  UPDATE public.orders o SET
    order_status = CASE WHEN o.order_status = 'pending_online_payment' AND p_payment_status = 'paid'
      THEN 'confirmed' ELSE o.order_status END,
    payment_status = p_payment_status,
    payment_method_detail = p_payment_method_detail,
    updated_at = now()
  WHERE o.id = p_order_id RETURNING o.id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Order not found: %', p_order_id; END IF;
  RETURN public.get_pos_order_json(v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pos_order_json(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_pos_order_atomic(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_pos_payment_status_atomic(uuid, text, text) TO authenticated;

-- A redemption and its usage count must succeed or fail together. Lock the
-- parent order to make retries idempotent even under concurrent POS requests.
CREATE OR REPLACE FUNCTION public.record_pos_coupon_redemption_atomic(
  p_coupon_id uuid, p_order_id uuid, p_user_id uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_coupon_code text;
  v_order_coupon text;
  v_usage_count integer;
  v_max_uses integer;
  v_existing_coupon_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role_slug IN ('admin', 'staff')
  ) THEN RAISE EXCEPTION 'POS staff access required'; END IF;

  SELECT coupon_code INTO v_order_coupon
  FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found: %', p_order_id; END IF;

  SELECT coupon_id INTO v_existing_coupon_id
  FROM public.coupon_redemptions WHERE order_id = p_order_id LIMIT 1;
  IF FOUND THEN
    IF v_existing_coupon_id = p_coupon_id THEN RETURN; END IF;
    RAISE EXCEPTION 'This order has already redeemed a different coupon';
  END IF;

  SELECT code, usage_count, max_uses
  INTO v_coupon_code, v_usage_count, v_max_uses
  FROM public.coupons WHERE id = p_coupon_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Coupon not found: %', p_coupon_id; END IF;
  IF upper(v_order_coupon) IS DISTINCT FROM upper(v_coupon_code) THEN
    RAISE EXCEPTION 'Order coupon does not match redemption';
  END IF;
  IF v_max_uses IS NOT NULL AND v_usage_count >= v_max_uses THEN
    RAISE EXCEPTION 'Coupon usage limit reached';
  END IF;

  INSERT INTO public.coupon_redemptions(coupon_id, order_id, user_id)
  VALUES (p_coupon_id, p_order_id, p_user_id);
  UPDATE public.coupons SET usage_count = usage_count + 1, updated_at = now()
  WHERE id = p_coupon_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_pos_coupon_redemption_atomic(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_pos_coupon_redemption_atomic(uuid, uuid, uuid) TO authenticated;

DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'sale_categories', 'sale_products', 'sale_product_addon_groups',
    'addon_groups', 'addon_items', 'sale_product_ingredients', 'products',
    'promotions', 'promotion_products', 'pos_layouts', 'order_items'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    END IF;
  END LOOP;
END;
$$;
