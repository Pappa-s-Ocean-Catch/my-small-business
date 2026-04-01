-- Migration: Add 'pending_online_payment' to order_status enum constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_status_check 
  CHECK (order_status IN ('pending', 'pending_online_payment', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'));

COMMENT ON COLUMN public.orders.order_status IS 'Order status: pending, pending_online_payment, confirmed, preparing, ready, completed, cancelled';
