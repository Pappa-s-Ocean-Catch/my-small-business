-- Add-on System for Menu Items
-- This migration creates tables for add-on groups and items that can be attached to sale products

-- Add-on Groups (e.g., "Extras", "Sauces", "Sizes")
CREATE TABLE IF NOT EXISTS public.addon_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT false, -- Whether at least one item from this group must be selected
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add-on Items (individual items within a group, e.g., "Extra Cheese", "Bacon")
CREATE TABLE IF NOT EXISTS public.addon_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_group_id UUID NOT NULL REFERENCES public.addon_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  extra_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Many-to-many relationship: Sale Products <-> Add-on Groups
CREATE TABLE IF NOT EXISTS public.sale_product_addon_groups (
  sale_product_id UUID NOT NULL REFERENCES public.sale_products(id) ON DELETE CASCADE,
  addon_group_id UUID NOT NULL REFERENCES public.addon_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (sale_product_id, addon_group_id)
);

-- Add constraints
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'addon_items_price_non_negative'
    ) THEN
        ALTER TABLE public.addon_items 
        ADD CONSTRAINT addon_items_price_non_negative 
        CHECK (extra_price >= 0);
    END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_addon_groups_active ON public.addon_groups(is_active);
CREATE INDEX IF NOT EXISTS idx_addon_groups_sort_order ON public.addon_groups(sort_order);
CREATE INDEX IF NOT EXISTS idx_addon_items_group ON public.addon_items(addon_group_id);
CREATE INDEX IF NOT EXISTS idx_addon_items_active ON public.addon_items(is_active);
CREATE INDEX IF NOT EXISTS idx_addon_items_sort_order ON public.addon_items(sort_order);
CREATE INDEX IF NOT EXISTS idx_sale_product_addon_groups_product ON public.sale_product_addon_groups(sale_product_id);
CREATE INDEX IF NOT EXISTS idx_sale_product_addon_groups_group ON public.sale_product_addon_groups(addon_group_id);

-- Add comments for documentation
COMMENT ON TABLE public.addon_groups IS 'Groups of add-on items that can be attached to menu items (e.g., "Extras", "Sauces")';
COMMENT ON TABLE public.addon_items IS 'Individual add-on items within a group (e.g., "Extra Cheese", "Bacon")';
COMMENT ON TABLE public.sale_product_addon_groups IS 'Many-to-many relationship between sale products and add-on groups';

COMMENT ON COLUMN public.addon_groups.is_required IS 'Whether at least one item from this group must be selected when ordering';
COMMENT ON COLUMN public.addon_items.extra_price IS 'Additional price for this add-on item';
COMMENT ON COLUMN public.addon_items.addon_group_id IS 'The add-on group this item belongs to';

-- Enable RLS on all new tables
ALTER TABLE public.addon_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addon_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_product_addon_groups ENABLE ROW LEVEL SECURITY;

-- Add-on Groups policies: read all, admin write
DROP POLICY IF EXISTS addon_groups_read_all ON public.addon_groups;
DROP POLICY IF EXISTS addon_groups_admin_ins ON public.addon_groups;
DROP POLICY IF EXISTS addon_groups_admin_upd ON public.addon_groups;
DROP POLICY IF EXISTS addon_groups_admin_del ON public.addon_groups;

CREATE POLICY addon_groups_read_all ON public.addon_groups FOR SELECT USING (true);
CREATE POLICY addon_groups_admin_ins ON public.addon_groups FOR INSERT WITH CHECK (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
CREATE POLICY addon_groups_admin_upd ON public.addon_groups FOR UPDATE USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
CREATE POLICY addon_groups_admin_del ON public.addon_groups FOR DELETE USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);

-- Add-on Items policies: read all, admin write
DROP POLICY IF EXISTS addon_items_read_all ON public.addon_items;
DROP POLICY IF EXISTS addon_items_admin_ins ON public.addon_items;
DROP POLICY IF EXISTS addon_items_admin_upd ON public.addon_items;
DROP POLICY IF EXISTS addon_items_admin_del ON public.addon_items;

CREATE POLICY addon_items_read_all ON public.addon_items FOR SELECT USING (true);
CREATE POLICY addon_items_admin_ins ON public.addon_items FOR INSERT WITH CHECK (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
CREATE POLICY addon_items_admin_upd ON public.addon_items FOR UPDATE USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
CREATE POLICY addon_items_admin_del ON public.addon_items FOR DELETE USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);

-- Sale Product Add-on Groups policies: read all, admin write
DROP POLICY IF EXISTS sale_product_addon_groups_read_all ON public.sale_product_addon_groups;
DROP POLICY IF EXISTS sale_product_addon_groups_admin_ins ON public.sale_product_addon_groups;
DROP POLICY IF EXISTS sale_product_addon_groups_admin_upd ON public.sale_product_addon_groups;
DROP POLICY IF EXISTS sale_product_addon_groups_admin_del ON public.sale_product_addon_groups;

CREATE POLICY sale_product_addon_groups_read_all ON public.sale_product_addon_groups FOR SELECT USING (true);
CREATE POLICY sale_product_addon_groups_admin_ins ON public.sale_product_addon_groups FOR INSERT WITH CHECK (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
CREATE POLICY sale_product_addon_groups_admin_upd ON public.sale_product_addon_groups FOR UPDATE USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);
CREATE POLICY sale_product_addon_groups_admin_del ON public.sale_product_addon_groups FOR DELETE USING (
  EXISTS(select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
);

-- Add triggers to update updated_at timestamp
CREATE TRIGGER update_addon_groups_updated_at 
  BEFORE UPDATE ON public.addon_groups 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_addon_items_updated_at 
  BEFORE UPDATE ON public.addon_items 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
