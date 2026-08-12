BEGIN;

INSERT INTO public.order_sync_state (singleton, updated_at)
VALUES (TRUE, '2026-08-12T00:00:00Z')
ON CONFLICT (singleton) DO UPDATE SET updated_at = EXCLUDED.updated_at;

DO $$
DECLARE
  before_insert TIMESTAMPTZ;
  after_insert TIMESTAMPTZ;
  after_update TIMESTAMPTZ;
  after_delete TIMESTAMPTZ;
  order_id UUID;
BEGIN
  SELECT updated_at INTO before_insert
  FROM public.order_sync_state
  WHERE singleton;

  INSERT INTO public.orders (
    order_number,
    customer_name,
    customer_email,
    customer_phone,
    order_type,
    payment_method,
    subtotal,
    tax,
    delivery_fee,
    service_fee,
    total
  ) VALUES (
    'SYNC-TEST-1',
    'Sync Test',
    'sync@example.invalid',
    '0400000000',
    'pickup',
    'cash',
    1,
    0,
    0,
    0,
    1
  ) RETURNING id INTO order_id;

  SELECT updated_at INTO after_insert
  FROM public.order_sync_state
  WHERE singleton;

  IF after_insert <= before_insert THEN
    RAISE EXCEPTION 'insert did not advance sync';
  END IF;

  UPDATE public.orders
  SET order_status = 'confirmed'
  WHERE id = order_id;

  SELECT updated_at INTO after_update
  FROM public.order_sync_state
  WHERE singleton;

  IF after_update <= after_insert THEN
    RAISE EXCEPTION 'update did not advance sync';
  END IF;

  DELETE FROM public.orders
  WHERE id = order_id;

  SELECT updated_at INTO after_delete
  FROM public.order_sync_state
  WHERE singleton;

  IF after_delete <= after_update THEN
    RAISE EXCEPTION 'delete did not advance sync';
  END IF;
END $$;

ROLLBACK;
