-- Create staff_holidays table
CREATE TABLE public.staff_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    is_approved BOOLEAN DEFAULT FALSE NOT NULL,
    
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Enable Row Level Security (RLS) for staff_holidays
ALTER TABLE public.staff_holidays ENABLE ROW LEVEL SECURITY;

-- Policies for staff_holidays
CREATE POLICY "Admins manage all staff holidays" ON public.staff_holidays
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin'));

CREATE POLICY "Staff view own holidays" ON public.staff_holidays
FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND id = staff_id));

-- Create index for efficient date range queries
CREATE INDEX idx_staff_holidays_staff_date ON public.staff_holidays(staff_id, start_date, end_date);

-- Create function to check if staff is on holiday on a specific date
CREATE OR REPLACE FUNCTION public.is_staff_on_holiday(staff_uuid UUID, check_date DATE)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.staff_holidays 
        WHERE staff_id = staff_uuid 
        AND check_date BETWEEN start_date AND end_date
        AND is_approved = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_staff_on_holiday(UUID, DATE) TO authenticated;
