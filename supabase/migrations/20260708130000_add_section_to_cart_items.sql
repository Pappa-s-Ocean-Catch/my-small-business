ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS section TEXT;

ALTER TABLE public.cart_item_addons
  ADD COLUMN IF NOT EXISTS section TEXT;

COMMENT ON COLUMN public.cart_items.section IS
  'Kitchen or menu section associated with the cart item for routing and receipt grouping';

COMMENT ON COLUMN public.cart_item_addons.section IS
  'Kitchen or menu section associated with the cart item add-on for routing and receipt grouping';
