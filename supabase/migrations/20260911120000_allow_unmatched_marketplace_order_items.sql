-- Marketplace orders must retain provider item lines even when no POS product
-- can be resolved. Denormalized order-item fields preserve the provider data.
ALTER TABLE public.order_items
  ALTER COLUMN product_id DROP NOT NULL;

COMMENT ON COLUMN public.order_items.product_id IS
  'Linked POS product when resolved; null for preserved unmatched marketplace item lines or deleted products.';
