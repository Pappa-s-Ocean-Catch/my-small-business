CREATE TABLE public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE CHECK (token ~ '^[A-Z0-9]{8}$'),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  stripe_checkout_url text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payment_links_active_token_idx ON public.payment_links (token, expires_at);

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
