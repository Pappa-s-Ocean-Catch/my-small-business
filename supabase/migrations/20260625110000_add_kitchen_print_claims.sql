ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS kitchen_print_claimed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS kitchen_print_claimed_by TEXT,
ADD COLUMN IF NOT EXISTS kitchen_print_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS kitchen_print_completed_by TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_kitchen_print_completed_at
  ON public.orders(kitchen_print_completed_at);

CREATE OR REPLACE FUNCTION public.claim_kitchen_print(
  p_order_id UUID,
  p_device_id TEXT,
  p_stale_after_seconds INTEGER DEFAULT 120
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_row_count BIGINT;
BEGIN
  UPDATE public.orders
  SET
    kitchen_print_claimed_at = NOW(),
    kitchen_print_claimed_by = p_device_id,
    updated_at = NOW()
  WHERE id = p_order_id
    AND payment_status <> 'refunded'
    AND order_status NOT IN ('completed', 'cancelled')
    AND kitchen_print_completed_at IS NULL
    AND (
      kitchen_print_claimed_at IS NULL
      OR kitchen_print_claimed_at < NOW() - make_interval(secs => GREATEST(p_stale_after_seconds, 1))
    );

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_kitchen_print(
  p_order_id UUID,
  p_device_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_row_count BIGINT;
BEGIN
  UPDATE public.orders
  SET
    kitchen_print_completed_at = NOW(),
    kitchen_print_completed_by = p_device_id,
    updated_at = NOW()
  WHERE id = p_order_id
    AND kitchen_print_completed_at IS NULL
    AND kitchen_print_claimed_by = p_device_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_kitchen_print_claim(
  p_order_id UUID,
  p_device_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_row_count BIGINT;
BEGIN
  UPDATE public.orders
  SET
    kitchen_print_claimed_at = NULL,
    kitchen_print_claimed_by = NULL,
    updated_at = NOW()
  WHERE id = p_order_id
    AND kitchen_print_completed_at IS NULL
    AND kitchen_print_claimed_by = p_device_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_kitchen_print(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_kitchen_print(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_kitchen_print_claim(UUID, TEXT) TO authenticated;

COMMENT ON COLUMN public.orders.kitchen_print_claimed_at IS 'When a POS device claimed the first kitchen print for this order';
COMMENT ON COLUMN public.orders.kitchen_print_claimed_by IS 'Stable POS device identifier that claimed the kitchen print';
COMMENT ON COLUMN public.orders.kitchen_print_completed_at IS 'When the first kitchen print completed successfully';
COMMENT ON COLUMN public.orders.kitchen_print_completed_by IS 'Stable POS device identifier that completed the kitchen print';
