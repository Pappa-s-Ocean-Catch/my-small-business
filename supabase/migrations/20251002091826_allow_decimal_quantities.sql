-- Allow decimal values for inventory quantities
-- This migration changes integer fields to decimal to support fractional quantities
-- for more flexible inventory management (e.g., 2.5 kg, 1.25 litres)

-- Drop dependent views first
DROP VIEW IF EXISTS public.inventory_financial_summary;
DROP VIEW IF EXISTS public.products_with_stock_status;
DROP VIEW IF EXISTS public.products_with_box_inventory;
DROP VIEW IF EXISTS public.inventory_movement_summary;

-- Change quantity_in_stock from INTEGER to DECIMAL
ALTER TABLE public.products 
ALTER COLUMN quantity_in_stock TYPE DECIMAL(10,3);

-- Change reorder_level from INTEGER to DECIMAL
ALTER TABLE public.products 
ALTER COLUMN reorder_level TYPE DECIMAL(10,3);

-- Change warning_threshold from INTEGER to DECIMAL
ALTER TABLE public.products 
ALTER COLUMN warning_threshold TYPE DECIMAL(10,3);

-- Change alert_threshold from INTEGER to DECIMAL
ALTER TABLE public.products 
ALTER COLUMN alert_threshold TYPE DECIMAL(10,3);

-- Drop the generated column first since it depends on units_per_box
ALTER TABLE public.products 
DROP COLUMN IF EXISTS total_units;

-- Change units_per_box from INTEGER to DECIMAL
ALTER TABLE public.products 
ALTER COLUMN units_per_box TYPE DECIMAL(10,3);

-- Change full_boxes from INTEGER to DECIMAL
ALTER TABLE public.products 
ALTER COLUMN full_boxes TYPE DECIMAL(10,3);

-- Change loose_units from INTEGER to DECIMAL
ALTER TABLE public.products 
ALTER COLUMN loose_units TYPE DECIMAL(10,3);

-- Recreate the computed total_units column with DECIMAL support
ALTER TABLE public.products 
ADD COLUMN total_units DECIMAL(10,3) GENERATED ALWAYS AS (full_boxes * units_per_box + loose_units) STORED;

-- Update constraints to work with DECIMAL values
-- Drop existing constraints that might conflict
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_units_per_box_positive'
    ) THEN
        ALTER TABLE public.products 
        DROP CONSTRAINT products_units_per_box_positive;
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_full_boxes_non_negative'
    ) THEN
        ALTER TABLE public.products 
        DROP CONSTRAINT products_full_boxes_non_negative;
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_loose_units_non_negative'
    ) THEN
        ALTER TABLE public.products 
        DROP CONSTRAINT products_loose_units_non_negative;
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_loose_units_valid'
    ) THEN
        ALTER TABLE public.products 
        DROP CONSTRAINT products_loose_units_valid;
    END IF;
END $$;

-- Add new constraints for DECIMAL values
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_units_per_box_positive_decimal'
    ) THEN
        ALTER TABLE public.products 
        ADD CONSTRAINT products_units_per_box_positive_decimal 
        CHECK (units_per_box > 0);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_full_boxes_non_negative_decimal'
    ) THEN
        ALTER TABLE public.products 
        ADD CONSTRAINT products_full_boxes_non_negative_decimal 
        CHECK (full_boxes >= 0);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_loose_units_non_negative_decimal'
    ) THEN
        ALTER TABLE public.products 
        ADD CONSTRAINT products_loose_units_non_negative_decimal 
        CHECK (loose_units >= 0);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'products_loose_units_valid_decimal'
    ) THEN
        ALTER TABLE public.products 
        ADD CONSTRAINT products_loose_units_valid_decimal 
        CHECK (loose_units <= units_per_box);
    END IF;
END $$;

-- Update inventory_movements table to support decimal quantities
-- First, fix any negative values that would violate constraints
UPDATE public.inventory_movements 
SET boxes_added = 0, units_added = 0 
WHERE boxes_added < 0 OR units_added < 0;

ALTER TABLE public.inventory_movements 
ALTER COLUMN quantity_change TYPE DECIMAL(10,3);

ALTER TABLE public.inventory_movements 
ALTER COLUMN boxes_added TYPE DECIMAL(10,3);

ALTER TABLE public.inventory_movements 
ALTER COLUMN units_added TYPE DECIMAL(10,3);

ALTER TABLE public.inventory_movements 
ALTER COLUMN previous_boxes TYPE DECIMAL(10,3);

ALTER TABLE public.inventory_movements 
ALTER COLUMN previous_loose_units TYPE DECIMAL(10,3);

ALTER TABLE public.inventory_movements 
ALTER COLUMN new_boxes TYPE DECIMAL(10,3);

ALTER TABLE public.inventory_movements 
ALTER COLUMN new_loose_units TYPE DECIMAL(10,3);

ALTER TABLE public.inventory_movements 
ALTER COLUMN previous_quantity TYPE DECIMAL(10,3);

ALTER TABLE public.inventory_movements 
ALTER COLUMN new_quantity TYPE DECIMAL(10,3);

-- Update constraints for inventory_movements
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_movements_boxes_non_negative'
    ) THEN
        ALTER TABLE public.inventory_movements 
        DROP CONSTRAINT inventory_movements_boxes_non_negative;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_movements_boxes_non_negative_decimal'
    ) THEN
        ALTER TABLE public.inventory_movements 
        ADD CONSTRAINT inventory_movements_boxes_non_negative_decimal 
        CHECK (boxes_added >= 0 AND units_added >= 0);
    END IF;
END $$;

-- Recreate the dropped views with decimal support
-- Recreate inventory_financial_summary view
CREATE OR REPLACE VIEW public.inventory_financial_summary AS
SELECT 
  p.id as product_id,
  p.name as product_name,
  p.sku,
  p.quantity_in_stock,
  p.purchase_price,
  p.sale_price,
  -- Calculate average cost from purchases
  COALESCE(
    (SELECT AVG(unit_cost)
     FROM public.inventory_movements 
     WHERE product_id = p.id 
     AND movement_type = 'purchase' 
     AND unit_cost IS NOT NULL), 
    p.purchase_price
  ) as average_cost,
  -- Calculate total COGS
  p.quantity_in_stock * COALESCE(
    (SELECT AVG(unit_cost) 
     FROM public.inventory_movements 
     WHERE product_id = p.id 
     AND movement_type = 'purchase' 
     AND unit_cost IS NOT NULL), 
    p.purchase_price
  ) as total_cogs,
  -- Calculate profit margin
  (p.sale_price - COALESCE(
    (SELECT AVG(unit_cost) 
     FROM public.inventory_movements 
     WHERE product_id = p.id 
     AND movement_type = 'purchase' 
     AND unit_cost IS NOT NULL), 
    p.purchase_price
  )) as profit_per_unit,
  -- Calculate potential revenue from current stock
  p.quantity_in_stock * p.sale_price as potential_revenue
FROM public.products p
WHERE p.is_active = true;

-- Recreate products_with_stock_status view
CREATE OR REPLACE VIEW public.products_with_stock_status AS
SELECT 
  p.*,
  CASE 
    WHEN p.total_units <= p.alert_threshold THEN 'critical'
    WHEN p.total_units <= p.warning_threshold THEN 'warning'
    ELSE 'good'
  END as stock_status
FROM public.products p
WHERE p.is_active = true;

-- Recreate products_with_box_inventory view
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

-- Recreate inventory_movement_summary view
CREATE OR REPLACE VIEW public.inventory_movement_summary AS
SELECT
  im.product_id,
  p.name as product_name,
  p.sku,
  COUNT(*) as total_movements,
  SUM(CASE WHEN im.movement_type = 'purchase' THEN im.quantity_change ELSE 0 END) as total_purchased,
  SUM(CASE WHEN im.movement_type = 'sale' THEN im.quantity_change ELSE 0 END) as total_sold,
  SUM(CASE WHEN im.movement_type = 'adjustment' THEN im.quantity_change ELSE 0 END) as total_adjusted,
  SUM(CASE WHEN im.movement_type = 'waste' THEN im.quantity_change ELSE 0 END) as total_wasted,
  AVG(CASE WHEN im.movement_type = 'purchase' AND im.unit_cost IS NOT NULL THEN im.unit_cost END) as avg_purchase_cost,
  MIN(im.created_at) as first_movement,
  MAX(im.created_at) as last_movement
FROM public.inventory_movements im
JOIN public.products p ON im.product_id = p.id
GROUP BY im.product_id, p.name, p.sku;

-- Add comments for documentation
COMMENT ON COLUMN public.products.quantity_in_stock IS 'Current stock quantity (supports decimal values for fractional units)';
COMMENT ON COLUMN public.products.reorder_level IS 'Reorder level threshold (supports decimal values)';
COMMENT ON COLUMN public.products.warning_threshold IS 'Warning threshold (supports decimal values)';
COMMENT ON COLUMN public.products.alert_threshold IS 'Alert threshold (supports decimal values)';
COMMENT ON COLUMN public.products.units_per_box IS 'Number of units per box (supports decimal values for fractional boxes)';
COMMENT ON COLUMN public.products.full_boxes IS 'Number of complete boxes (supports decimal values)';
COMMENT ON COLUMN public.products.loose_units IS 'Number of loose units (supports decimal values)';
COMMENT ON COLUMN public.products.total_units IS 'Total units calculated from boxes and loose units (supports decimal values)';
