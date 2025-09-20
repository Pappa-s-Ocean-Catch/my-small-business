-- Create sections table for shop areas
CREATE TABLE public.sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT DEFAULT '#3B82F6', -- Default blue color
    active BOOLEAN DEFAULT TRUE NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL
);

-- Enable Row Level Security (RLS) for sections
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

-- Policies for sections
CREATE POLICY "Admins manage sections" ON public.sections
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin'));

CREATE POLICY "Staff view sections" ON public.sections
FOR SELECT USING (active = TRUE);

-- Add section_id to shifts table
ALTER TABLE public.shifts
ADD COLUMN section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL;

-- Add section preferences to staff table
ALTER TABLE public.staff
ADD COLUMN preferred_sections UUID[] DEFAULT '{}';

-- Insert default sections
INSERT INTO public.sections (name, description, color, sort_order) VALUES
('Fry', 'Frying station and deep fryer operations', '#EF4444', 1),
('Cashier', 'Customer service and payment processing', '#10B981', 2),
('Grill', 'Grilling and cooking operations', '#F59E0B', 3),
('Prep', 'Food preparation and kitchen prep work', '#8B5CF6', 4),
('Delivery', 'Delivery and takeout operations', '#06B6D4', 5);

-- Create index for better performance
CREATE INDEX idx_shifts_section_id ON public.shifts(section_id);
CREATE INDEX idx_sections_active_sort ON public.sections(active, sort_order);

-- Update existing shifts to have a default section (Fry)
UPDATE public.shifts 
SET section_id = (SELECT id FROM public.sections WHERE name = 'Fry' LIMIT 1)
WHERE section_id IS NULL;
