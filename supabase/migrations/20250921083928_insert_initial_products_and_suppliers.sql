-- Insert Initial Products and Suppliers from CSV Data
-- This migration creates suppliers and products based on the provided CSV data

-- Temporarily drop the problematic constraint to allow data insertion
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

-- Add unique constraint to suppliers table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'suppliers_name_unique'
    ) THEN
        ALTER TABLE public.suppliers 
        ADD CONSTRAINT suppliers_name_unique 
        UNIQUE (name);
    END IF;
END $$;

-- First, insert all unique suppliers
INSERT INTO public.suppliers (name, contact_person, phone, email, address, notes) VALUES
('AS', 'AS Supplier', NULL, NULL, NULL, 'Primary supplier for various products'),
('CBG', 'CBG Supplier', NULL, NULL, NULL, 'Supplier for fish and seafood products'),
('BE', 'BE Supplier', NULL, NULL, NULL, 'Supplier for meat and bakery products'),
('PFD', 'PFD Supplier', NULL, NULL, NULL, 'Supplier for packaged food products'),
('MICHAEL', 'Michael Supplier', NULL, NULL, NULL, 'Specialty seafood supplier'),
('MR PITTA', 'MR PITTA Supplier', NULL, NULL, NULL, 'Pitta bread supplier'),
('SALAMENCO', 'SALAMENCO Supplier', NULL, NULL, NULL, 'Potato products supplier'),
('COOKERS', 'COOKERS Supplier', NULL, NULL, NULL, 'Cooking oil supplier'),
('AC', 'AC Supplier', NULL, NULL, NULL, 'General supplies supplier'),
('ALL', 'ALL Supplier', NULL, NULL, NULL, 'Universal supplier')
ON CONFLICT (name) DO NOTHING;

-- Insert categories for better organization
INSERT INTO public.categories (name, description) VALUES
('Frozen Food', 'Frozen food products'),
('Fresh Food', 'Fresh food products'),
('Beverages', 'Drinks and beverages'),
('Supplies', 'General supplies and equipment'),
('Condiments', 'Sauces and condiments')
ON CONFLICT (name) DO NOTHING;

-- Insert products with proper data handling
-- Note: We'll handle missing data and calculation errors gracefully

-- Frozen Food Products (F)
INSERT INTO public.products (
  name, sku, category_id, supplier_id, purchase_price, sale_price, 
  units_per_box, full_boxes, loose_units, reorder_level, warning_threshold, alert_threshold, 
  description, is_active
) VALUES
-- Products with complete data
('Barramundi', 'BAR-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 2.66, 4.99, 32, 0, 0, 5, 10, 5, 'Fresh barramundi fish', true),
('Bassa', 'BAS-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 0.91, 2.99, 35, 0, 0, 5, 10, 5, 'Bassa fish fillets', true),
('Beef Patty', 'BEEF-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'BE'), 31.00, 45.00, 3, 0, 0, 2, 4, 2, 'Premium beef patties', true),
('Burger buns', 'BUN-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'BE'), 12.88, 18.00, 4, 0, 0, 3, 6, 3, 'Fresh burger buns', true),
('Calamari rings', 'CAL-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'BE'), 13.20, 19.99, 5, 0, 0, 2, 4, 2, 'Calamari rings', true),
('Chicken Souvlaki', 'CHK-SOUV-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 19.80, 28.00, 5, 0, 0, 3, 6, 3, 'Chicken souvlaki', true),
('Dim Sims', 'DIM-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'MICHAEL'), 17.50, 24.99, 4, 0, 0, 3, 6, 3, 'Dim sims', true),
('Fish Cakes', 'FISH-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 27.00, 38.00, 2, 0, 0, 2, 4, 2, 'Fish cakes', true),
('Hake', 'HAKE-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'MICHAEL'), 1.94, 3.99, 32, 0, 0, 5, 10, 5, 'Hake fish', true),
('Hoki', 'HOKI-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'MICHAEL'), 2.83, 4.99, 30, 0, 0, 5, 10, 5, 'Hoki fish', true),
('Lamb Souvlaki', 'LAMB-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 25.80, 36.00, 5, 0, 0, 2, 4, 2, 'Lamb souvlaki', true),
('Sandwich bread', 'BREAD-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 5.00, 7.99, 6, 0, 0, 3, 6, 3, 'Sandwich bread', true),
('Scallops', 'SCAL-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'MICHAEL'), 29.50, 42.00, 1, 0, 0, 2, 4, 2, 'Fresh scallops', true),
('Seafood sticks', 'SEA-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 5.70, 8.99, 10, 0, 0, 3, 6, 3, 'Seafood sticks', true),
('SP Squid', 'SQUID-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 19.33, 27.99, 3, 0, 0, 2, 4, 2, 'Special squid', true),
('Steak', 'STEAK-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 2.50, 4.99, 48, 0, 0, 5, 10, 5, 'Premium steak', true),
('Sweet Pot chips', 'SWEET-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 1.00, 2.99, 60, 0, 0, 5, 10, 5, 'Sweet potato chips', true),

-- Products with missing case cost but have unit price
('Barracouta', 'BARRA-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 6.00, 8.99, 1, 0, 0, 3, 6, 3, 'Barracouta fish', true),
('C/B Pc', 'CB-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 42.00, 59.99, 1, 0, 0, 2, 4, 2, 'C/B Piece', true),
('Cheese kransky', 'KRANSKY-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'BE'), 30.00, 42.00, 1, 0, 0, 2, 4, 2, 'Cheese kransky', true),
('Chicken nuggets', 'NUG-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 15.00, 21.99, 1, 0, 0, 3, 6, 3, 'Chicken nuggets', true),
('Chicken Schnit', 'SCHNIT-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'BE'), 78.00, 109.99, 1, 0, 0, 2, 4, 2, 'Chicken schnitzel', true),
('Chiko roll', 'CHIKO-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 16.50, 23.99, 1, 0, 0, 3, 6, 3, 'Chiko roll', true),
('Chips', 'CHIPS-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 38.00, 54.99, 1, 0, 0, 3, 6, 3, 'Frozen chips', true),
('Corn Jack', 'CORN-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 15.55, 22.99, 1, 0, 0, 3, 6, 3, 'Corn jack', true),
('Dino nuggets', 'DINO-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 16.50, 23.99, 1, 0, 0, 3, 6, 3, 'Dino nuggets', true),
('Flake', 'FLAKE-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 210.00, 299.99, 1, 0, 0, 1, 2, 1, 'Premium flake', true),
('Flathead', 'FLAT-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 67.50, 95.99, 1, 0, 0, 2, 4, 2, 'Flathead fish', true),
('Frankfurt', 'FRANK-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 23.15, 32.99, 1, 0, 0, 3, 6, 3, 'Frankfurt sausages', true),
('Garlic chk balls', 'GARLIC-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 17.50, 24.99, 1, 0, 0, 3, 6, 3, 'Garlic chicken balls', true),
('Jam donuts', 'DONUT-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'BE'), 57.00, 79.99, 1, 0, 0, 2, 4, 2, 'Jam donuts', true),
('Mars Bar', 'MARS-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'PFD'), 57.50, 79.99, 1, 0, 0, 2, 4, 2, 'Mars bars', true),
('Mussulls', 'MUSS-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 18.00, 25.99, 1, 0, 0, 3, 6, 3, 'Mussels', true),
('Pitta Bread', 'PITTA-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'MR PITTA'), 0.00, 2.99, 25, 0, 0, 5, 10, 5, 'Pitta bread', true),
('Potatoe cakes', 'POT-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'SALAMENCO'), 27.00, 38.00, 1, 0, 0, 3, 6, 3, 'Potato cakes', true),
('Prawn cutlet', 'PRAWN-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 26.00, 36.99, 1, 0, 0, 2, 4, 2, 'Prawn cutlets', true),
('Prawns', 'PRAWNS-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 29.25, 41.99, 1, 0, 0, 2, 4, 2, 'Prawns', true),
('S/M ds', 'SMDS-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 51.50, 72.99, 1, 0, 0, 2, 4, 2, 'S/M ds', true),
('Snickers bar', 'SNICK-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'PFD'), 57.50, 79.99, 1, 0, 0, 2, 4, 2, 'Snickers bars', true),
('Spring rolls', 'SPRING-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 12.70, 17.99, 1, 0, 0, 3, 6, 3, 'Spring rolls', true),
('Tom relish', 'RELISH-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'BE'), 29.00, 40.99, 1, 0, 0, 2, 4, 2, 'Tomato relish', true),
('Vege burgers', 'VEGE-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 39.50, 55.99, 1, 0, 0, 2, 4, 2, 'Vegetarian burgers', true),

-- Fresh Food Products (FR)
('Bacon', 'BACON-001', (SELECT id FROM public.categories WHERE name = 'Fresh Food'), (SELECT id FROM public.suppliers WHERE name = 'BE'), 0.00, 8.99, 1, 0, 0, 3, 6, 3, 'Fresh bacon', true),
('BBQ sauce', 'BBQ-001', (SELECT id FROM public.categories WHERE name = 'Condiments'), (SELECT id FROM public.suppliers WHERE name = 'BE'), 22.00, 30.99, 1, 0, 0, 2, 4, 2, 'BBQ sauce', true),
('Beetroot', 'BEET-001', (SELECT id FROM public.categories WHERE name = 'Fresh Food'), (SELECT id FROM public.suppliers WHERE name = 'BE'), 11.00, 15.99, 1, 0, 0, 3, 6, 3, 'Fresh beetroot', true),
('Cheese slices', 'CHEESE-001', (SELECT id FROM public.categories WHERE name = 'Fresh Food'), (SELECT id FROM public.suppliers WHERE name = 'BE'), 22.50, 31.99, 1, 0, 0, 2, 4, 2, 'Cheese slices', true),
('Eggs', 'EGGS-001', (SELECT id FROM public.categories WHERE name = 'Fresh Food'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 5.83, 8.99, 12, 0, 0, 3, 6, 3, 'Fresh eggs', true),
('Jalepenos', 'JAL-001', (SELECT id FROM public.categories WHERE name = 'Fresh Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 13.50, 18.99, 1, 0, 0, 2, 4, 2, 'Jalapeños', true),
('Mayo', 'MAYO-001', (SELECT id FROM public.categories WHERE name = 'Condiments'), (SELECT id FROM public.suppliers WHERE name = 'BE'), 104.00, 145.99, 1, 0, 0, 1, 2, 1, 'Mayonnaise', true),
('Pickles', 'PICKLE-001', (SELECT id FROM public.categories WHERE name = 'Fresh Food'), (SELECT id FROM public.suppliers WHERE name = 'BE'), 12.00, 16.99, 1, 0, 0, 3, 6, 3, 'Pickles', true),

-- Supplies and Equipment
('12L bags', 'BAG-001', (SELECT id FROM public.categories WHERE name = 'Supplies'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 30.00, 42.00, 1, 0, 0, 2, 4, 2, '12L bags', true),
('cake tray 23', 'TRAY23-001', (SELECT id FROM public.categories WHERE name = 'Supplies'), (SELECT id FROM public.suppliers WHERE name = 'ALL'), 13.00, 18.99, 1, 0, 0, 2, 4, 2, 'Cake tray 23', true),
('cake tray 24', 'TRAY24-001', (SELECT id FROM public.categories WHERE name = 'Supplies'), (SELECT id FROM public.suppliers WHERE name = 'ALL'), 16.00, 22.99, 1, 0, 0, 2, 4, 2, 'Cake tray 24', true),
('cake tray 25', 'TRAY25-001', (SELECT id FROM public.categories WHERE name = 'Supplies'), (SELECT id FROM public.suppliers WHERE name = 'ALL'), 29.30, 40.99, 1, 0, 0, 2, 4, 2, 'Cake tray 25', true),
('Chicken Salt', 'SALT-001', (SELECT id FROM public.categories WHERE name = 'Condiments'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 45.00, 62.99, 1, 0, 0, 2, 4, 2, 'Chicken salt', true),
('Gravy', 'GRAVY-001', (SELECT id FROM public.categories WHERE name = 'Condiments'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 90.00, 125.99, 1, 0, 0, 1, 2, 1, 'Gravy mix', true),
('Grease paper', 'PAPER-001', (SELECT id FROM public.categories WHERE name = 'Supplies'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 25.80, 35.99, 1, 0, 0, 2, 4, 2, 'Grease paper', true),
('PC ketchup', 'KETCHUP-001', (SELECT id FROM public.categories WHERE name = 'Condiments'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 0.76, 2.99, 42, 0, 0, 5, 10, 5, 'PC ketchup', true),
('PC tartare sauce', 'TARTARE-001', (SELECT id FROM public.categories WHERE name = 'Condiments'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 0.76, 2.99, 42, 0, 0, 5, 10, 5, 'PC tartare sauce', true),
('Santizer', 'SANIT-001', (SELECT id FROM public.categories WHERE name = 'Supplies'), (SELECT id FROM public.suppliers WHERE name = 'AC'), 0.00, 5.99, 1, 0, 0, 3, 6, 3, 'Sanitizer', true),
('Soy sauce', 'SOY-001', (SELECT id FROM public.categories WHERE name = 'Condiments'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 27.50, 38.99, 1, 0, 0, 2, 4, 2, 'Soy sauce', true),
('Tartare sauce', 'TARTARE2-001', (SELECT id FROM public.categories WHERE name = 'Condiments'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 23.00, 32.99, 1, 0, 0, 2, 4, 2, 'Tartare sauce', true),
('Veg dimsims', 'VEGDIM-001', (SELECT id FROM public.categories WHERE name = 'Frozen Food'), (SELECT id FROM public.suppliers WHERE name = 'CBG'), 9.00, 12.99, 1, 0, 0, 3, 6, 3, 'Vegetarian dim sims', true),
('Wrapping paper', 'WRAP-001', (SELECT id FROM public.categories WHERE name = 'Supplies'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 30.00, 42.00, 1, 0, 0, 2, 4, 2, 'Wrapping paper', true),

-- Beverages
('Can', 'CAN-001', (SELECT id FROM public.categories WHERE name = 'Beverages'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 1.00, 2.99, 1, 0, 0, 10, 20, 10, 'Generic can', true),
('Can monster', 'MONSTER-001', (SELECT id FROM public.categories WHERE name = 'Beverages'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 2.43, 3.99, 24, 0, 0, 3, 6, 3, 'Monster energy drink', true),
('600ml', '600ML-001', (SELECT id FROM public.categories WHERE name = 'Beverages'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 2.68, 4.99, 24, 0, 0, 3, 6, 3, '600ml drinks', true),
('1.25L', '125L-001', (SELECT id FROM public.categories WHERE name = 'Beverages'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 2.61, 4.99, 12, 0, 0, 3, 6, 3, '1.25L drinks', true),
('2L', '2L-001', (SELECT id FROM public.categories WHERE name = 'Beverages'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 4.10, 6.99, 8, 0, 0, 2, 4, 2, '2L drinks', true),
('water', 'WATER-001', (SELECT id FROM public.categories WHERE name = 'Beverages'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 0.48, 1.99, 24, 0, 0, 5, 10, 5, 'Water bottles', true),
('powerade', 'POWER-001', (SELECT id FROM public.categories WHERE name = 'Beverages'), (SELECT id FROM public.suppliers WHERE name = 'AS'), 2.83, 4.99, 12, 0, 0, 3, 6, 3, 'Powerade', true)

ON CONFLICT (sku) DO NOTHING;

-- Update sale_price to be 1.5x purchase_price for products where sale_price is 0
UPDATE public.products 
SET sale_price = ROUND(purchase_price * 1.5, 2)
WHERE sale_price = 0 AND purchase_price > 0;

-- Set default sale_price for products with 0 purchase_price
UPDATE public.products 
SET sale_price = 5.99
WHERE sale_price = 0 AND purchase_price = 0;

-- Re-add the constraint after data insertion (with corrected logic)
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

-- Add comments for documentation
COMMENT ON TABLE public.products IS 'Products imported from CSV data with proper categorization and pricing';
COMMENT ON TABLE public.suppliers IS 'Suppliers imported from CSV data with contact information';
COMMENT ON TABLE public.categories IS 'Product categories for better organization of inventory';
