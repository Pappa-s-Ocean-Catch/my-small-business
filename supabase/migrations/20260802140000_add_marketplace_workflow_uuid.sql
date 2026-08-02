ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS marketplace_workflow_uuid TEXT;
