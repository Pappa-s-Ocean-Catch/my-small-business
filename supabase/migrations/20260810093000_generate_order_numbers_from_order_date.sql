CREATE OR REPLACE FUNCTION public.generate_order_number(order_date TIMESTAMPTZ DEFAULT NOW())
RETURNS TEXT AS $$
DECLARE
  date_prefix TEXT;
  sequence_num INTEGER;
BEGIN
  date_prefix := 'ORD-' || TO_CHAR(order_date AT TIME ZONE 'Australia/Melbourne', 'YYYYMMDD') || '-';
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM LENGTH(date_prefix) + 1) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM public.orders
   WHERE order_number LIKE date_prefix || '%';
  RETURN date_prefix || LPAD(sequence_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := public.generate_order_number(COALESCE(NEW.created_at, NOW()));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
