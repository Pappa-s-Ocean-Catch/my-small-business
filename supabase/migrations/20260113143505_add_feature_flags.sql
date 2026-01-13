-- Migration: Add feature flags for order system
-- Feature flags: enable_pickup_order, enable_online_payment, enable_instore_payment, enable_online_delivery

-- Insert default feature flags (all enabled by default)
INSERT INTO public.settings (key, value)
VALUES (
  'feature_flags',
  jsonb_build_object(
    'enable_pickup_order', true,
    'enable_online_payment', true,
    'enable_instore_payment', true,
    'enable_online_delivery', false
  )
)
ON CONFLICT (key) DO NOTHING;

-- Add comment
COMMENT ON TABLE public.settings IS 'Application settings stored as key-value pairs. Feature flags control order system features.';
