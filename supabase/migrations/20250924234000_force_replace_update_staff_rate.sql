-- Force replace update_staff_rate function to ensure no ON CONFLICT references

DROP FUNCTION IF EXISTS public.update_staff_rate(UUID, DECIMAL, VARCHAR(10), DATE);

CREATE FUNCTION public.update_staff_rate(
  p_staff_id UUID,
  p_new_rate DECIMAL,
  p_rate_type VARCHAR(10) DEFAULT 'default',
  p_effective_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
BEGIN
  -- Serialize per (staff, rate_type)
  PERFORM pg_advisory_xact_lock(hashtext(p_staff_id::text || ':' || p_rate_type));

  -- No-op if same as current
  IF EXISTS (
    SELECT 1 FROM public.staff_rates
    WHERE staff_id = p_staff_id
      AND rate_type = p_rate_type
      AND is_current = true
      AND rate = p_new_rate
  ) THEN
    RETURN;
  END IF;

  -- Mark any current rows as historical
  UPDATE public.staff_rates
  SET end_date = p_effective_date - INTERVAL '1 day', is_current = false
  WHERE staff_id = p_staff_id AND rate_type = p_rate_type AND is_current = true;

  -- Insert new current row. Retry once if another writer slipped in.
  BEGIN
    INSERT INTO public.staff_rates (staff_id, rate, rate_type, effective_date, end_date, is_current, created_at)
    VALUES (p_staff_id, p_new_rate, p_rate_type, p_effective_date, '9999-12-31', true, NOW());
  EXCEPTION WHEN unique_violation THEN
    UPDATE public.staff_rates
    SET is_current = false,
        end_date = CASE WHEN end_date > CURRENT_DATE THEN CURRENT_DATE - INTERVAL '1 day' ELSE end_date END
    WHERE staff_id = p_staff_id AND rate_type = p_rate_type AND is_current = true;

    INSERT INTO public.staff_rates (staff_id, rate, rate_type, effective_date, end_date, is_current, created_at)
    VALUES (p_staff_id, p_new_rate, p_rate_type, p_effective_date, '9999-12-31', true, NOW());
  END;
END;
$$ LANGUAGE plpgsql;
