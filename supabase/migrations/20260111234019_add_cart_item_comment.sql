-- Add comment field to cart_items table
-- This allows users to add special instructions or notes for each item

ALTER TABLE public.cart_items 
ADD COLUMN IF NOT EXISTS comment TEXT;

COMMENT ON COLUMN public.cart_items.comment IS 'Optional comment or special instructions for this cart item';
