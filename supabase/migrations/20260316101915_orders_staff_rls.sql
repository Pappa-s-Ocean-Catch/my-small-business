-- Allow staff to manage order status and payment (read orders, update order_status and payment_status).
-- Staff can SELECT and UPDATE orders; they can SELECT order_items and order_item_addons to view order details.

-- orders: staff can read and update (for status/payment management)
DROP POLICY IF EXISTS orders_staff_select ON public.orders;
CREATE POLICY orders_staff_select ON public.orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role_slug = 'staff')
  );

DROP POLICY IF EXISTS orders_staff_update ON public.orders;
CREATE POLICY orders_staff_update ON public.orders
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role_slug = 'staff')
  );

-- order_items: staff can read (to display order details in order management app)
DROP POLICY IF EXISTS order_items_staff_select ON public.order_items;
CREATE POLICY order_items_staff_select ON public.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role_slug = 'staff')
  );

-- order_item_addons: staff can read
DROP POLICY IF EXISTS order_item_addons_staff_select ON public.order_item_addons;
CREATE POLICY order_item_addons_staff_select ON public.order_item_addons
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role_slug = 'staff')
  );
