-- Fix duplicate movement records by removing conflicting triggers
-- The issue is that multiple triggers are firing when inventory is updated

-- Drop the trigger that creates movements when product quantity changes
-- This is causing duplicates because update_inventory_with_boxes already creates movements
DROP TRIGGER IF EXISTS trigger_handle_product_quantity_change ON public.products;
DROP TRIGGER IF EXISTS on_product_quantity_change ON public.products;

-- Also drop the trigger that updates product quantity when movements are created
-- This creates a circular dependency and duplicate records
DROP TRIGGER IF EXISTS trigger_update_product_quantity ON public.inventory_movements;

-- Drop the function that was causing the circular updates
DROP FUNCTION IF EXISTS public.update_product_quantity_on_movement();

-- Keep the handle_product_quantity_change function but don't use it as a trigger
-- It can be used manually if needed, but the update_inventory_with_boxes function
-- should be the primary way to update inventory and create movements

-- Add a comment explaining the new approach
COMMENT ON FUNCTION public.update_inventory_with_boxes IS 'Primary function for updating inventory. Creates movement records and updates product quantities in one atomic operation.';

-- Ensure the update_inventory_with_boxes function also updates quantity_in_stock
-- for backward compatibility with existing code that might check this field
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
  SELECT units_per_box, full_boxes, loose_units, quantity_in_stock
  INTO v_units_per_box, v_current_boxes, v_current_loose_units, v_previous_total
  FROM public.products
  WHERE id = p_product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  
  -- Calculate total units to add
  v_total_units_to_add := (p_boxes_to_add * v_units_per_box) + p_units_to_add;
  
  -- Calculate new inventory levels
  v_new_total := v_previous_total + v_total_units_to_add;
  
  -- Convert new total back to boxes and units
  SELECT full_boxes, loose_units
  INTO v_new_boxes, v_new_loose_units
  FROM public.convert_units_to_boxes(v_new_total, v_units_per_box);
  
  -- Update product inventory (including quantity_in_stock for backward compatibility)
  UPDATE public.products
  SET 
    full_boxes = v_new_boxes,
    loose_units = v_new_loose_units,
    quantity_in_stock = v_new_total,  -- Keep this updated for backward compatibility
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
