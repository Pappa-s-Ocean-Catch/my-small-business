-- A payment-link order starts as `online`, but a customer can later pay cash
-- at the counter. Keep the primary payment method in sync with that confirmed
-- tender so order details and payment reports agree.
DROP FUNCTION IF EXISTS public.update_pos_payment_status_atomic(uuid, text, text);

CREATE FUNCTION public.update_pos_payment_status_atomic(
  p_order_id uuid,
  p_payment_status text,
  p_payment_method_detail text DEFAULT NULL,
  p_payment_method text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  UPDATE public.orders o SET
    order_status = CASE WHEN o.order_status = 'pending_online_payment' AND p_payment_status = 'paid'
      THEN 'confirmed' ELSE o.order_status END,
    payment_status = p_payment_status,
    payment_method = CASE WHEN p_payment_method = 'store' THEN 'store' ELSE o.payment_method END,
    payment_method_detail = p_payment_method_detail,
    updated_at = now()
  WHERE o.id = p_order_id RETURNING o.id INTO v_id;

  IF v_id IS NULL THEN RAISE EXCEPTION 'Order not found: %', p_order_id; END IF;
  RETURN public.get_pos_order_json(v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_pos_payment_status_atomic(uuid, text, text, text) TO authenticated;
