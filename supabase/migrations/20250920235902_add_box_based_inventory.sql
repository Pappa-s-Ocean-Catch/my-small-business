-- Box-Based Inventory System
-- This migration adds box-based inventory tracking to the products table

-- Add box-based inventory fields to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS units_per_box INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS full_boxes INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS loose_units INTEGER NOT NULL DEFAULT 0;

-- Add constraints to ensure data integrity (using DO blocks to handle IF NOT EXISTS)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_units_per_box_positive'
    ) THEN
        ALTER TABLE public.products 
        ADD CONSTRAINT products_units_per_box_positive 
        CHECK (units_per_box > 0);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_full_boxes_non_negative'
    ) THEN
        ALTER TABLE public.products 
        ADD CONSTRAINT products_full_boxes_non_negative 
        CHECK (full_boxes >= 0);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_loose_units_non_negative'
    ) THEN
        ALTER TABLE public.products 
        ADD CONSTRAINT products_loose_units_non_negative 
        CHECK (loose_units >= 0);
    END IF;
END $$;

-- Add constraint to ensure loose_units <= units_per_box (can't have more loose units than a full box)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_loose_units_valid'
    ) THEN
        ALTER TABLE public.products 
        ADD CONSTRAINT products_loose_units_valid 
        CHECK (loose_units <= units_per_box);
    END IF;
END $$;

-- Add computed column for total units (replaces quantity_in_stock)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS total_units INTEGER GENERATED ALWAYS AS (full_boxes * units_per_box + loose_units) STORED;

-- Add comments for documentation
COMMENT ON COLUMN public.products.units_per_box IS 'Number of individual units contained in one box/case';
COMMENT ON COLUMN public.products.full_boxes IS 'Number of complete boxes in inventory';
COMMENT ON COLUMN public.products.loose_units IS 'Number of loose units (less than one box)';
COMMENT ON COLUMN public.products.total_units IS 'Total units calculated from boxes and loose units';

-- Migrate existing quantity_in_stock to box-based system
-- For existing products, assume they are individual items (units_per_box = 1)
-- and put all stock as loose_units
-- Handle cases where quantity_in_stock > 1 by setting units_per_box appropriately
UPDATE public.products 
SET 
  units_per_box = CASE 
    WHEN quantity_in_stock > 1 THEN quantity_in_stock
    ELSE 1
  END,
  full_boxes = CASE 
    WHEN quantity_in_stock > 1 THEN 1
    ELSE 0
  END,
  loose_units = CASE 
    WHEN quantity_in_stock > 1 THEN 0
    ELSE quantity_in_stock
  END
WHERE units_per_box = 1 AND full_boxes = 0 AND loose_units = 0;

-- Add box/unit breakdown to inventory_movements table
ALTER TABLE public.inventory_movements 
ADD COLUMN IF NOT EXISTS boxes_added INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS units_added INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_boxes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_loose_units INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_boxes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_loose_units INTEGER DEFAULT 0;

-- Add constraints for inventory_movements (using DO blocks to handle IF NOT EXISTS)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_movements_boxes_non_negative'
    ) THEN
        ALTER TABLE public.inventory_movements 
        ADD CONSTRAINT inventory_movements_boxes_non_negative 
        CHECK (boxes_added >= 0 AND units_added >= 0);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_movements_previous_non_negative'
    ) THEN
        ALTER TABLE public.inventory_movements 
        ADD CONSTRAINT inventory_movements_previous_non_negative 
        CHECK (previous_boxes >= 0 AND previous_loose_units >= 0);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_movements_new_non_negative'
    ) THEN
        ALTER TABLE public.inventory_movements 
        ADD CONSTRAINT inventory_movements_new_non_negative 
        CHECK (new_boxes >= 0 AND new_loose_units >= 0);
    END IF;
END $$;

-- Create function to convert total units to boxes and loose units
CREATE OR REPLACE FUNCTION public.convert_units_to_boxes(
  total_units INTEGER,
  units_per_box INTEGER
)
RETURNS TABLE(full_boxes INTEGER, loose_units INTEGER) AS $$
BEGIN
  RETURN QUERY SELECT 
    (total_units / units_per_box)::INTEGER as full_boxes,
    (total_units % units_per_box)::INTEGER as loose_units;
END;
$$ LANGUAGE plpgsql;

-- Create function to convert boxes and units to total units
CREATE OR REPLACE FUNCTION public.convert_boxes_to_units(
  full_boxes INTEGER,
  loose_units INTEGER,
  units_per_box INTEGER
)
RETURNS INTEGER AS $$
BEGIN
  RETURN (full_boxes * units_per_box) + loose_units;
END;
$$ LANGUAGE plpgsql;

-- Create function to update inventory with box/unit logic
CREATE OR REPLACE FUNCTION public.update_inventory_with_boxes(
  p_product_id UUID,
  p_boxes_to_add INTEGER DEFAULT 0,
  p_units_to_add INTEGER DEFAULT 0,
  p_movement_type TEXT DEFAULT 'adjustment',
  p_reason TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_units_per_box INTEGER;
  v_current_boxes INTEGER;
  v_current_loose_units INTEGER;
  v_new_boxes INTEGER;
  v_new_loose_units INTEGER;
  v_total_units_to_add INTEGER;
  v_previous_total INTEGER;
  v_new_total INTEGER;
BEGIN
  -- Get product's units_per_box and current inventory
  SELECT units_per_box, full_boxes, loose_units
  INTO v_units_per_box, v_current_boxes, v_current_loose_units
  FROM public.products
  WHERE id = p_product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  
  -- Calculate total units to add
  v_total_units_to_add := (p_boxes_to_add * v_units_per_box) + p_units_to_add;
  
  -- Calculate new inventory levels
  v_previous_total := (v_current_boxes * v_units_per_box) + v_current_loose_units;
  v_new_total := v_previous_total + v_total_units_to_add;
  
  -- Convert new total back to boxes and units
  SELECT full_boxes, loose_units
  INTO v_new_boxes, v_new_loose_units
  FROM public.convert_units_to_boxes(v_new_total, v_units_per_box);
  
  -- Update product inventory
  UPDATE public.products
  SET 
    full_boxes = v_new_boxes,
    loose_units = v_new_loose_units,
    updated_at = NOW()
  WHERE id = p_product_id;
  
  -- Record the movement
  INSERT INTO public.inventory_movements (
    product_id, movement_type, quantity_change,
    boxes_added, units_added,
    previous_boxes, previous_loose_units,
    new_boxes, new_loose_units,
    previous_quantity, new_quantity,
    reason, reference, notes, created_by
  ) VALUES (
    p_product_id, p_movement_type, v_total_units_to_add,
    p_boxes_to_add, p_units_to_add,
    v_current_boxes, v_current_loose_units,
    v_new_boxes, v_new_loose_units,
    v_previous_total, v_new_total,
    p_reason, p_reference, p_notes, p_created_by
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function for end-of-day inventory adjustment
CREATE OR REPLACE FUNCTION public.adjust_inventory_end_of_day(
  p_product_id UUID,
  p_new_boxes INTEGER,
  p_new_loose_units INTEGER,
  p_reason TEXT DEFAULT 'End of day adjustment',
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_units_per_box INTEGER;
  v_current_boxes INTEGER;
  v_current_loose_units INTEGER;
  v_previous_total INTEGER;
  v_new_total INTEGER;
  v_boxes_change INTEGER;
  v_units_change INTEGER;
BEGIN
  -- Get product's units_per_box and current inventory
  SELECT units_per_box, full_boxes, loose_units
  INTO v_units_per_box, v_current_boxes, v_current_loose_units
  FROM public.products
  WHERE id = p_product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  
  -- Validate new loose units don't exceed units per box
  IF p_new_loose_units > v_units_per_box THEN
    RAISE EXCEPTION 'Loose units cannot be greater than units per box';
  END IF;
  
  -- Calculate changes
  v_previous_total := (v_current_boxes * v_units_per_box) + v_current_loose_units;
  v_new_total := (p_new_boxes * v_units_per_box) + p_new_loose_units;
  v_boxes_change := p_new_boxes - v_current_boxes;
  v_units_change := p_new_loose_units - v_current_loose_units;
  
  -- Update product inventory
  UPDATE public.products
  SET 
    full_boxes = p_new_boxes,
    loose_units = p_new_loose_units,
    updated_at = NOW()
  WHERE id = p_product_id;
  
  -- Record the movement
  INSERT INTO public.inventory_movements (
    product_id, movement_type, quantity_change,
    boxes_added, units_added,
    previous_boxes, previous_loose_units,
    new_boxes, new_loose_units,
    previous_quantity, new_quantity,
    reason, reference, notes, created_by
  ) VALUES (
    p_product_id, 'adjustment', v_new_total - v_previous_total,
    v_boxes_change, v_units_change,
    v_current_boxes, v_current_loose_units,
    p_new_boxes, p_new_loose_units,
    v_previous_total, v_new_total,
    p_reason, NULL, p_notes, p_created_by
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create view for products with box-based inventory details
CREATE OR REPLACE VIEW public.products_with_box_inventory AS
SELECT 
  p.*,
  CASE 
    WHEN p.total_units <= p.alert_threshold THEN 'critical'
    WHEN p.total_units <= p.warning_threshold THEN 'warning'
    ELSE 'good'
  END as stock_status,
  -- Calculate how many boxes to order to reach reorder level
  CASE 
    WHEN p.total_units < p.reorder_level THEN
      CEIL((p.reorder_level - p.total_units)::DECIMAL / p.units_per_box)::INTEGER
    ELSE 0
  END as boxes_to_order
FROM public.products p
WHERE p.is_active = true;

-- Add comments for the new functions
COMMENT ON FUNCTION public.convert_units_to_boxes(INTEGER, INTEGER) IS 'Converts total units to full boxes and loose units';
COMMENT ON FUNCTION public.convert_boxes_to_units(INTEGER, INTEGER, INTEGER) IS 'Converts boxes and loose units to total units';
COMMENT ON FUNCTION public.update_inventory_with_boxes(UUID, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, UUID) IS 'Updates inventory by adding boxes and/or units';
COMMENT ON FUNCTION public.adjust_inventory_end_of_day(UUID, INTEGER, INTEGER, TEXT, TEXT, UUID) IS 'Adjusts inventory to specific box and unit counts (end of day)';
COMMENT ON VIEW public.products_with_box_inventory IS 'Products with box-based inventory details and ordering recommendations';
