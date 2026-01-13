-- Migration: Add delivery system support for Uber Direct integration
-- This includes delivery addresses, delivery tracking, and order delivery fields

-- Add delivery fields to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'pickup' CHECK (order_type IN ('pickup', 'delivery')),
  ADD COLUMN IF NOT EXISTS delivery_address_id UUID,
  ADD COLUMN IF NOT EXISTS delivery_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS delivery_city TEXT,
  ADD COLUMN IF NOT EXISTS delivery_state TEXT,
  ADD COLUMN IF NOT EXISTS delivery_postcode TEXT,
  ADD COLUMN IF NOT EXISTS delivery_country TEXT DEFAULT 'AU',
  ADD COLUMN IF NOT EXISTS delivery_latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS delivery_longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS delivery_quote_id TEXT, -- Uber Direct quote ID
  ADD COLUMN IF NOT EXISTS delivery_quote_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS delivery_quote_currency TEXT DEFAULT 'AUD',
  ADD COLUMN IF NOT EXISTS delivery_quote_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_eta_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS uber_delivery_id TEXT, -- Uber Direct delivery ID after creation
  ADD COLUMN IF NOT EXISTS delivery_status TEXT CHECK (delivery_status IN ('pending', 'quote_requested', 'quote_received', 'delivery_created', 'driver_assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'failed')),
  ADD COLUMN IF NOT EXISTS delivery_tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS delivery_driver_name TEXT,
  ADD COLUMN IF NOT EXISTS delivery_driver_phone TEXT,
  ADD COLUMN IF NOT EXISTS delivery_vehicle_info TEXT;

-- Create saved delivery addresses table
CREATE TABLE IF NOT EXISTS public.delivery_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL, -- e.g., "Home", "Work", "Office"
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postcode TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'AU',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create delivery tracking events table
CREATE TABLE IF NOT EXISTS public.delivery_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('quote_requested', 'quote_received', 'delivery_created', 'driver_assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'failed', 'status_update')),
  status TEXT,
  message TEXT,
  driver_name TEXT,
  driver_phone TEXT,
  vehicle_info TEXT,
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),
  estimated_arrival TIMESTAMPTZ,
  metadata JSONB, -- Store additional Uber Direct API response data
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON public.orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON public.orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_orders_uber_delivery_id ON public.orders(uber_delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_user_id ON public.delivery_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_events_order_id ON public.delivery_tracking_events(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_events_created_at ON public.delivery_tracking_events(created_at DESC);

-- RLS for delivery_addresses
ALTER TABLE public.delivery_addresses ENABLE ROW LEVEL SECURITY;

-- Customers can manage their own addresses, admins can view all
DROP POLICY IF EXISTS delivery_addresses_customer_all ON public.delivery_addresses;
CREATE POLICY delivery_addresses_customer_all ON public.delivery_addresses FOR ALL
  USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin')
  );

-- RLS for delivery_tracking_events
ALTER TABLE public.delivery_tracking_events ENABLE ROW LEVEL SECURITY;

-- Customers can read events for their orders, admins can read all
DROP POLICY IF EXISTS delivery_tracking_events_customer_read ON public.delivery_tracking_events;
CREATE POLICY delivery_tracking_events_customer_read ON public.delivery_tracking_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o 
      WHERE o.id = order_id 
      AND (
        o.user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin')
      )
    )
  );

-- Admins can insert/update tracking events
DROP POLICY IF EXISTS delivery_tracking_events_admin_all ON public.delivery_tracking_events;
CREATE POLICY delivery_tracking_events_admin_all ON public.delivery_tracking_events FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_slug = 'admin'));

-- Add trigger to update updated_at for delivery_addresses
CREATE TRIGGER update_delivery_addresses_updated_at
  BEFORE UPDATE ON public.delivery_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to ensure only one default address per user
CREATE OR REPLACE FUNCTION public.ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Unset other default addresses for this user
    UPDATE public.delivery_addresses
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to ensure only one default address
DROP TRIGGER IF EXISTS trg_ensure_single_default_address ON public.delivery_addresses;
CREATE TRIGGER trg_ensure_single_default_address
  BEFORE INSERT OR UPDATE ON public.delivery_addresses
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.ensure_single_default_address();

-- Add comments
COMMENT ON COLUMN public.orders.order_type IS 'Type of order: pickup or delivery';
COMMENT ON COLUMN public.orders.delivery_address_id IS 'Reference to saved delivery address if user selected one';
COMMENT ON COLUMN public.orders.uber_delivery_id IS 'Uber Direct delivery ID after delivery request is created';
COMMENT ON COLUMN public.orders.delivery_status IS 'Current status of the delivery from Uber Direct';
COMMENT ON TABLE public.delivery_addresses IS 'Saved delivery addresses for customers';
COMMENT ON TABLE public.delivery_tracking_events IS 'Tracking events for delivery orders from Uber Direct';
