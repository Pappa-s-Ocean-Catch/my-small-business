-- Update wage_payments table to support individual staff payments
-- First, drop the existing table and recreate with new structure
DROP TABLE IF EXISTS public.wage_payments;

-- Create new wage_payments table for individual staff payments
CREATE TABLE public.wage_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.staff(id) NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_hours DECIMAL(10,2) NOT NULL,
  total_wages DECIMAL(10,2) NOT NULL,
  booking_hours DECIMAL(10,2) NOT NULL,
  booking_wages DECIMAL(10,2) NOT NULL,
  cash_hours DECIMAL(10,2) NOT NULL,
  cash_wages DECIMAL(10,2) NOT NULL,
  payment_data JSONB NOT NULL, -- Store the complete breakdown data for this staff member
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.wage_payments ENABLE ROW LEVEL SECURITY;

-- Admins can view all wage payments
CREATE POLICY "Admins can view wage payments"
ON public.wage_payments
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin'));

-- Admins can create wage payments
CREATE POLICY "Admins can create wage payments"
ON public.wage_payments
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin'));

-- Create indexes for efficient queries
CREATE INDEX idx_wage_payments_staff_week ON public.wage_payments(staff_id, week_start, week_end);
CREATE INDEX idx_wage_payments_week_range ON public.wage_payments(week_start, week_end);
CREATE INDEX idx_wage_payments_created_by ON public.wage_payments(created_by);
CREATE INDEX idx_wage_payments_paid_at ON public.wage_payments(paid_at);
