-- Allow staff members to manage order_items and order_item_addons (insert, update, delete)
-- This is required for editing orders in the POS screen.

-- order_items policies: staff can do all operations
DROP POLICY IF EXISTS order_items_staff_all ON public.order_items;
CREATE POLICY order_items_staff_all ON public.order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.role_slug = 'staff' OR profiles.role_slug = 'admin'))
  );

-- order_item_addons policies: staff can do all operations
DROP POLICY IF EXISTS order_item_addons_staff_all ON public.order_item_addons;
CREATE POLICY order_item_addons_staff_all ON public.order_item_addons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.role_slug = 'staff' OR profiles.role_slug = 'admin'))
  );
