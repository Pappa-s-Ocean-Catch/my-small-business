-- Consolidate stock_movements and inventory_movements tables
-- This migration removes the redundant stock_movements table after ensuring all data is in inventory_movements

-- First, ensure all data from stock_movements is migrated to inventory_movements
-- (This should have been done in the enhanced_inventory_movements migration, but let's be safe)
INSERT INTO public.inventory_movements (
  product_id, 
  movement_type, 
  quantity_change, 
  previous_quantity, 
  new_quantity, 
  reason, 
  notes, 
  created_by,
  created_at
)
SELECT 
  product_id,
  CASE 
    WHEN movement_type = 'in' THEN 'received'
    WHEN movement_type = 'out' THEN 'consume'
    ELSE 'adjustment'
  END as movement_type,
  CASE 
    WHEN movement_type = 'in' THEN quantity_change
    WHEN movement_type = 'out' THEN -quantity_change
    ELSE quantity_change
  END as quantity_change,
  previous_quantity,
  new_quantity,
  reason,
  notes,
  created_by,
  created_at
FROM public.stock_movements
WHERE NOT EXISTS (
  SELECT 1 FROM public.inventory_movements 
  WHERE inventory_movements.product_id = stock_movements.product_id
  AND inventory_movements.created_at = stock_movements.created_at
  AND inventory_movements.quantity_change = stock_movements.quantity_change
);

-- Drop the old stock_movements table and its related objects
-- First, drop any triggers that might reference stock_movements
DROP TRIGGER IF EXISTS trigger_handle_product_quantity_change ON public.products;

-- Update the function to work with inventory_movements instead of dropping it
CREATE OR REPLACE FUNCTION public.handle_product_quantity_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create movement if quantity actually changed
  IF OLD.quantity_in_stock != NEW.quantity_in_stock THEN
    INSERT INTO public.inventory_movements (
      product_id,
      movement_type,
      quantity_change,
      previous_quantity,
      new_quantity,
      reason,
      created_by
    ) VALUES (
      NEW.id,
      CASE
        WHEN NEW.quantity_in_stock > OLD.quantity_in_stock THEN 'received'
        WHEN NEW.quantity_in_stock < OLD.quantity_in_stock THEN 'consume'
        ELSE 'adjustment'
      END,
      NEW.quantity_in_stock - OLD.quantity_in_stock,
      OLD.quantity_in_stock,
      NEW.quantity_in_stock,
      'Automatic quantity change',
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop indexes on stock_movements
DROP INDEX IF EXISTS idx_stock_movements_product_id;
DROP INDEX IF EXISTS idx_stock_movements_created_at;

-- Drop RLS policies on stock_movements
DROP POLICY IF EXISTS stock_movements_read_all ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_admin_ins ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_admin_upd ON public.stock_movements;
DROP POLICY IF EXISTS stock_movements_admin_del ON public.stock_movements;

-- Finally, drop the stock_movements table
DROP TABLE IF EXISTS public.stock_movements;

-- Function already updated above, no need to recreate

-- Recreate the trigger on products table
CREATE TRIGGER trigger_handle_product_quantity_change
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_product_quantity_change();

-- Ensure inventory_movements has proper foreign key relationship with profiles
DO $$ 
BEGIN
    -- Check if created_by column exists and has proper foreign key
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_movements_created_by_fkey'
    ) THEN
        -- Add the foreign key constraint if it doesn't exist
        ALTER TABLE public.inventory_movements 
        ADD CONSTRAINT inventory_movements_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES public.profiles(id);
    END IF;
END $$;

-- Update any remaining references in the codebase
-- The application should now only use inventory_movements table
