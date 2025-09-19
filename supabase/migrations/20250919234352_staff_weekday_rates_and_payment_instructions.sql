-- Add weekday rates to staff and create staff_payment_instructions

-- Staff weekday rates (nullable). Keep existing pay_rate as legacy/default if present; add default_rate for clarity.
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS default_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS mon_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS tue_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS wed_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS thu_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS fri_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS sat_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS sun_rate NUMERIC;

-- Backfill default_rate from existing pay_rate if available
UPDATE public.staff SET default_rate = COALESCE(default_rate, pay_rate) WHERE default_rate IS NULL;

-- Payment instructions table
CREATE TABLE IF NOT EXISTS public.staff_payment_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  label TEXT NOT NULL, -- e.g., Booking, Non-booking
  adjustment_per_hour NUMERIC NOT NULL DEFAULT 0, -- can be negative or positive
  weekly_hours_cap NUMERIC, -- null = unlimited
  payment_method TEXT, -- free text, e.g., booking, non-booking, payroll code
  priority INTEGER NOT NULL DEFAULT 1, -- lower first
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Ensure priority uniqueness per staff for deterministic allocation
CREATE UNIQUE INDEX IF NOT EXISTS staff_payment_instructions_staff_priority_idx
  ON public.staff_payment_instructions(staff_id, priority);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staff_payment_instructions_updated_at ON public.staff_payment_instructions;
CREATE TRIGGER trg_staff_payment_instructions_updated_at
BEFORE UPDATE ON public.staff_payment_instructions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.staff_payment_instructions ENABLE ROW LEVEL SECURITY;

-- Admins manage all
DROP POLICY IF EXISTS "Admins manage staff payment instructions" ON public.staff_payment_instructions;
CREATE POLICY "Admins manage staff payment instructions" ON public.staff_payment_instructions
  FOR ALL
  USING (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin'))
  WITH CHECK (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin'));

-- Staff can view their own (optional)
DROP POLICY IF EXISTS "Staff view own payment instructions" ON public.staff_payment_instructions;
CREATE POLICY "Staff view own payment instructions" ON public.staff_payment_instructions
  FOR SELECT
  USING (exists (
    select 1 from public.staff s
    join public.profiles p on p.id = s.id
    where s.id = staff_payment_instructions.staff_id and p.id = auth.uid()
  ));


