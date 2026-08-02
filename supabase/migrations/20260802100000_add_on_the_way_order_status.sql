ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_order_status_check
  CHECK (
    order_status IN (
      'pending',
      'pending_online_payment',
      'confirmed',
      'preparing',
      'ready',
      'on_the_way',
      'completed',
      'cancelled',
      'refunded'
    )
  );
