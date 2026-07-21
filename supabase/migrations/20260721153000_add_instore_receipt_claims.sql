-- Add secure one-time receipt claim fields for anonymous in-store orders.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS receipt_claim_token TEXT,
  ADD COLUMN IF NOT EXISTS receipt_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_claimed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_receipt_claim_token
  ON public.orders(receipt_claim_token)
  WHERE receipt_claim_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_receipt_claimed_by_user_id
  ON public.orders(receipt_claimed_by_user_id)
  WHERE receipt_claimed_by_user_id IS NOT NULL;

COMMENT ON COLUMN public.orders.receipt_claim_token IS 'Opaque one-time token printed on anonymous in-store receipts so customers can securely link the order later.';
COMMENT ON COLUMN public.orders.receipt_claimed_at IS 'When the receipt claim token was successfully redeemed by a customer account.';
COMMENT ON COLUMN public.orders.receipt_claimed_by_user_id IS 'Customer account that redeemed the receipt claim token.';
