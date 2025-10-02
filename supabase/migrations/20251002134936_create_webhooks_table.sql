-- Create webhooks table for external system integration
-- This migration creates a webhooks table to store webhook configurations
-- for accepting transaction data from external systems

-- Create webhooks table
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  webhook_type TEXT NOT NULL DEFAULT 'transaction',
  secret_ref TEXT, -- Reference to Doppler secret for authentication
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Add constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'webhooks_webhook_type_valid'
    ) THEN
        ALTER TABLE public.webhooks
        ADD CONSTRAINT webhooks_webhook_type_valid
        CHECK (webhook_type IN ('transaction', 'inventory', 'customer', 'order'));
    END IF;
END $$;

-- Add RLS policies
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view all webhooks
CREATE POLICY "Admins can view all webhooks" ON public.webhooks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role_slug = 'admin'
    )
  );

-- Policy: Only admins can insert webhooks
CREATE POLICY "Admins can insert webhooks" ON public.webhooks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role_slug = 'admin'
    )
  );

-- Policy: Only admins can update webhooks
CREATE POLICY "Admins can update webhooks" ON public.webhooks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role_slug = 'admin'
    )
  );

-- Policy: Only admins can delete webhooks
CREATE POLICY "Admins can delete webhooks" ON public.webhooks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role_slug = 'admin'
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.webhooks IS 'Webhook configurations for receiving data from external systems';
COMMENT ON COLUMN public.webhooks.name IS 'Human-readable name for the webhook';
COMMENT ON COLUMN public.webhooks.description IS 'Optional description of the webhook purpose';
COMMENT ON COLUMN public.webhooks.webhook_type IS 'Type of data this webhook processes (transaction, inventory, customer, order)';
COMMENT ON COLUMN public.webhooks.secret_ref IS 'Reference to Doppler secret for authentication header';
COMMENT ON COLUMN public.webhooks.is_enabled IS 'Whether the webhook is active';
COMMENT ON COLUMN public.webhooks.created_by IS 'User who created this webhook';
