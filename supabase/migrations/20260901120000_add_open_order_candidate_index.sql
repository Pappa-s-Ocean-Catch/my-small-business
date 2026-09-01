CREATE INDEX IF NOT EXISTS idx_orders_open_candidate_created_at
  ON public.orders (created_at DESC)
  WHERE order_status NOT IN ('completed', 'cancelled', 'refunded', 'pending_online_payment')
    AND payment_status <> 'refunded';
