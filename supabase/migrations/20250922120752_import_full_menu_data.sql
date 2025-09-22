-- Import Full Menu Data from full-menu.json
-- This migration imports all menu categories, sub-categories, and products from the provided JSON data

-- First, clear existing sample data to avoid conflicts
DELETE FROM public.sale_products WHERE sale_category_id IN (
    SELECT id FROM public.sale_categories WHERE name IN (
        'Beverages', 'Food', 'Desserts'
    )
);
DELETE FROM public.sale_categories WHERE name IN ('Beverages', 'Food', 'Desserts');

-- Insert main categories from the menu data
INSERT INTO public.sale_categories (name, description, sort_order) VALUES
('BEEF BURGERS', 'Delicious beef burgers with various toppings', 1),
('CHICKEN BURGERS', 'Tender chicken burgers and fillets', 2),
('FISH BURGERS', 'Fresh fish burgers and fillets', 3),
('VEGETARIAN BURGERS', 'Plant-based burger options', 4),
('STEAK SANDWICHES', 'Premium steak sandwiches', 5),
('SOUVLAKI', 'Traditional Greek wraps and souvlaki', 6),
('CHICKEN/LAMB SNACK PACK', 'Hearty snack packs with meat and chips', 7),
('PACKS', 'Combo packs and meal deals', 8),
('FISH', 'Fresh fish fillets and seafood', 9),
('CHIPS', 'Various chip sizes and types', 10),
('Chips And Gravy', 'Chips served with gravy', 11),
('SEAFOOD SIDES', 'Individual seafood items', 12),
('SIDES', 'Various side dishes and snacks', 13),
('SWEET', 'Desserts and sweet treats', 14),
('DRINKS', 'Beverages and drinks', 15),
('SAUCES', 'Condiments and sauces', 16),
('ALL DAY BREAKFAST', 'Breakfast items available all day', 17)
ON CONFLICT (name) DO NOTHING;

-- Insert sub-categories for DRINKS
INSERT INTO public.sale_categories (name, description, parent_category_id, sort_order) 
SELECT 
    sub_cat.name,
    sub_cat.description,
    main_cat.id,
    sub_cat.sort_order
FROM (VALUES 
    ('Can', 'Canned beverages', 1),
    ('600ml Bottle', '600ml bottled drinks', 2),
    ('1.25l Bottle', '1.25 liter bottled drinks', 3),
    ('2l Bottle', '2 liter bottled drinks', 4),
    ('Water', 'Bottled water', 5),
    ('Powerade Ion4', 'Sports drinks', 6)
) AS sub_cat(name, description, sort_order)
CROSS JOIN public.sale_categories main_cat
WHERE main_cat.name = 'DRINKS'
ON CONFLICT (name) DO NOTHING;

-- Insert BEEF BURGERS products
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    cat.id
FROM (VALUES 
    ('Plain Beef Burger', 'Beef patty, lettuce, & tomato sauce.', 7.50),
    ('The Lot Burger', 'Beef patty, egg, bacon, cheese, tomato, red onion, lettuce, & tomato relish', 11.50),
    ('Cheese Burger', 'Beef patty, cheese, lettuce, & tomato sauce', 7.95),
    ('Double Cheese Burger', 'Two beef patties, double cheese, lettuce, & tomato sauce', 12.50),
    ('Bit Cheese Burger', 'Beef patty, bacon, lettuce, tomato, cheese, mayo, & tomato sauce', 10.20),
    ('Bbq Cheese Burger', 'Beef patty, cheese, bacon, red onion, lettuce, & bbq sauce', 10.90),
    ('The Aussie Burger', 'Beef patty, egg, bacon, cheese, beetroot, tomato, red onion, lettuce, bbq sauce, & tomato sauce', 12.00),
    ('Tropical Burger', 'Beef patty, pineapple, bacon, cheese, lettuce, mango, & tomato relish', 10.50),
    ('Mexican Burger', 'Beef patty, jalapenos, cheese, tomato, red onion, lettuce, & peri peri mayo', 10.90),
    ('Royale With Cheese Burger', 'Beef patty, double cheese, red onion, pickles, tomato relish & american mustard', 11.50)
) AS product(name, description, price)
CROSS JOIN public.sale_categories cat
WHERE cat.name = 'BEEF BURGERS'
ON CONFLICT (name) DO NOTHING;

-- Insert CHICKEN BURGERS products
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    cat.id
FROM (VALUES 
    ('Plain Chicken Burger', 'Breaded fillet schmaltz, lettuce, & mayo', 7.95),
    ('Chicken Burger With The Lot', 'Breaded fillet schmaltz, bacon, egg, cheese, tomato, lettuce, & mayo', 12.00),
    ('Chicken Bit Burger', 'Breaded fillet schmaltz, bacon, lettuce, tomato, cheese, & mayo', 10.00),
    ('Hawaiian Chicken Burger', 'Breaded fillet schmaltz, bacon, pineapple, cheese, lettuce, & mayo', 11.00),
    ('Peri Peri Chicken Burger', 'Breaded fillet schmaltz, jalapenos, cheese, tomato, red onion, lettuce, & peri peri mayo', 10.00),
    ('Traditional Chicken Schmaltz', 'crumbed breaded fillet schmaltz, lettuce and mayo', 10.00),
    ('Kids Chicken Burger', 'Crumbled chicken patty, lettuce and tomato sauce', 7.00)
) AS product(name, description, price)
CROSS JOIN public.sale_categories cat
WHERE cat.name = 'CHICKEN BURGERS'
ON CONFLICT (name) DO NOTHING;

-- Insert FISH BURGERS products
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    cat.id
FROM (VALUES 
    ('Plain Fish Burger', 'Flake (grilled or fried), lettuce, & tartare', 12.20),
    ('Classic Fish Burger', 'Flake (grilled or fried), cheese, tomato, lettuce, & tartare', 13.50)
) AS product(name, description, price)
CROSS JOIN public.sale_categories cat
WHERE cat.name = 'FISH BURGERS'
ON CONFLICT (name) DO NOTHING;

-- Insert VEGETARIAN BURGERS products
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    cat.id
FROM (VALUES 
    ('Plain Veggie Burger', 'Gourmet vegetable patty, lettuce, & tomato sauce', 9.50),
    ('Classic Veggie Burger', 'Gourmet vegetable patty, cheese, tomato, red onion, lettuce, mayo, & tomato relish', 11.00)
) AS product(name, description, price)
CROSS JOIN public.sale_categories cat
WHERE cat.name = 'VEGETARIAN BURGERS'
ON CONFLICT (name) DO NOTHING;

-- Insert STEAK SANDWICHES products
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    cat.id
FROM (VALUES 
    ('Plain Steak Sandwich', 'Gourmet steak, lettuce, & tomato sauce', 11.00),
    ('Classic Steak Sandwich', 'Gourmet steak, lettuce, tomato sauce, cheese, tomato, & red onion', 11.00),
    ('Classic Steak Lot', 'Gourmet steak, lettuce, tomato sauce, cheese, egg, bacon, tomato & red onion', 14.50)
) AS product(name, description, price)
CROSS JOIN public.sale_categories cat
WHERE cat.name = 'STEAK SANDWICHES'
ON CONFLICT (name) DO NOTHING;

-- Insert SOUVLAKI products
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    cat.id
FROM (VALUES 
    ('Lamb Souvlaki', 'Lamb yiros meat, lettuce, tomato, red onion, & garlic sauce', 13.95),
    ('Chicken Souvlaki', 'Chicken Yiros meat, lettuce, tomato, red onion, & garlic sauce', 13.95),
    ('Mix Souvlaki', 'Lamb and Chicken yiros meat, lettuce, tomato, red onion, & garlic sauce', 15.50),
    ('Fish Souvlaki', 'Flake (grilled or fried), lettuce, tomato, red onion, & tartare sauce', 14.50),
    ('Vegetable Souvlaki', 'Gourmet vegetable patty, lettuce, tomato, beetroot, red onion, & mayo', 11.00),
    ('Souva With The Lot', 'Lamb yiros meat, egg, bacon, cheese, lettuce, tomato, red onion & tzatziki.', 18.50)
) AS product(name, description, price)
CROSS JOIN public.sale_categories cat
WHERE cat.name = 'SOUVLAKI'
ON CONFLICT (name) DO NOTHING;

-- Insert CHICKEN/LAMB SNACK PACK products
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    cat.id
FROM (VALUES 
    ('Chicken Snack Pack', 'Delicious chicken yiros meat with chips and cheese, topped with chilli, barbecue and homemade garlic sauce.', 17.95),
    ('Lamb Snack Pack', 'Delicious Lamb yiros meat with chips and cheese, topped with chilli, barbecue and homemade garlic sauce.', 17.95),
    ('Mix Snack Pack', 'Delicious chicken and lamb yiros meat with chips and cheese, topped with chilli, barbecue and homemade garlic sauce.', 19.95)
) AS product(name, description, price)
CROSS JOIN public.sale_categories cat
WHERE cat.name = 'CHICKEN/LAMB SNACK PACK'
ON CONFLICT (name) DO NOTHING;

-- Insert PACKS products
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    cat.id
FROM (VALUES 
    ('Flake Pack For One', '1 x Flake, 1 x Potato Cake, 1 x Dim Sim, & Small Chips', 15.50),
    ('Flake Pack For Two', '2 x Flake, 2 x Potato Cakes, 2 x Dim Sims, & Small Chips', 27.75),
    ('Family Flake Pack', '4 x Flake, 4 x Potato Cakes, 4 x Dim Sims, & Medium Chips', 57.00),
    ('Pack for 3', '3 Butter fish, 3 potato cakes, 3 dim sims and medium chips.', 42.00),
    ('Flathead Pack', '6 x Flathead filets, & Medium Chips', 24.00),
    ('Dim & Cake Pack', '2 x Potato Cakes, 2 x Dim Sims, & Small Chips', 12.70),
    ('Party Pack', '8 x Potato Cakes, 8 x Dim Sims, & Extra Large Chips', 42.00),
    ('Chicken Breast Nuggets - 8 Nuggets', '', 8.50),
    ('Chicken Breast Nuggets - 12 Nugget', '', 13.00),
    ('Calamari Pack', '4 x Panko Crumbed Calamari, & Small Chips', 12.20),
    ('Salt & Pepper Squid Pack', '8 x Salt & Pepper Squid, & Small Chips', 13.80),
    ('Kids Snack Pack', '2 x Flathead Fillets, & Small Chips', 12.20),
    ('Kids Pack', '1 fish bite, 1 potato cake, 1 dim sim and $2.00 of chips.', 11.00),
    ('Fishermans Catch', '1 Flake, 1 scallop, 1 seafood stick, 2 calamari rings, half serve chips and 375ml can', 23.00),
    ('Nuggets And Chips Pack', '', 6.90)
) AS product(name, description, price)
CROSS JOIN public.sale_categories cat
WHERE cat.name = 'PACKS'
ON CONFLICT (name) DO NOTHING;

-- Insert FISH products
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    cat.id
FROM (VALUES 
    ('Flake (Australian)', 'Grilled or fried', 9.20),
    ('Blue Grenadier', 'Grilled or fried', 9.50),
    ('Flathead', '3 fillets fried only', 9.50),
    ('Barramundi', 'Grilled or fried', 10.50),
    ('Whiting', 'Grilled or fried', 9.50),
    ('Butter Fish', 'Grilled or fried', 9.50),
    ('Barracouta', '', 14.50)
) AS product(name, description, price)
CROSS JOIN public.sale_categories cat
WHERE cat.name = 'FISH'
ON CONFLICT (name) DO NOTHING;

-- Insert CHIPS products
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    cat.id
FROM (VALUES 
    ('Half Serve Chips', '', 3.00),
    ('Small Chips', 'Serves 1', 5.50),
    ('Medium Chips', 'Serves 2-3', 8.00),
    ('Large Chips', 'Serves 3-4', 10.50),
    ('Extra Large Chips', 'Serves 4-5', 12.50),
    ('Sweet Potato Chips', 'A serve of Sweet Potato chips seasoned with salt and choice of sauce.', 7.30)
) AS product(name, description, price)
CROSS JOIN public.sale_categories cat
WHERE cat.name = 'CHIPS'
ON CONFLICT (name) DO NOTHING;

-- Insert Chips And Gravy products
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    cat.id
FROM (VALUES 
    ('Small chips and gravy', '', 5.50),
    ('Large chips and gravy', '', 7.70)
) AS product(name, description, price)
CROSS JOIN public.sale_categories cat
WHERE cat.name = 'Chips And Gravy'
ON CONFLICT (name) DO NOTHING;

-- Insert SEAFOOD SIDES products
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    cat.id
FROM (VALUES 
    ('Seafood Stick', '', 2.00),
    ('Fish Bite', '', 4.60),
    ('Prawn Cutlet', '', 2.95),
    ('Fish Cake', '', 3.75),
    ('Calamari Ring', 'Panko crumbed', 1.95),
    ('Scallop', '', 3.60),
    ('Salt & Pepper Squid', 'Serve of 8', 8.50),
    ('Prawn In Batter', '', 3.95),
    ('Mussell In Batter', '', 2.75)
) AS product(name, description, price)
CROSS JOIN public.sale_categories cat
WHERE cat.name = 'SEAFOOD SIDES'
ON CONFLICT (name) DO NOTHING;

-- Insert SIDES products
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    cat.id
FROM (VALUES 
    ('Dim Sim - Steamed', '', 1.80),
    ('Dim Sim - Fried', '', 1.80),
    ('Potato Cake', '', 1.80),
    ('Spring Roll', '', 4.20),
    ('Chiko Roll', '', 4.20),
    ('Corn Jack', '', 4.20),
    ('Chicken Breast Nugget (Single)', '', 1.20),
    ('Frankfurt In Batter', '', 4.75),
    ('Burger In Batter', '', 5.20),
    ('Vegie Dim Sim', '', 2.20),
    ('Pickled Onion', '', 2.00),
    ('South Melbourne Dim Sim', '', 3.40),
    ('Cheese Kransky In Batter', '', 4.95),
    ('Dimm Sim In Batter', '', 2.85),
    ('Cheese & Bacon Potato Cake', '', 5.50),
    ('Gravy Small', '', 3.50),
    ('Gravy Medium', '', 5.50),
    ('Gravy Large', '', 7.50),
    ('Dino Nuggets', '', 1.10),
    ('Garlic Chicken Balls', 'Great tasting chicken balls filled with garlic butter centre and parsley.', 2.20),
    ('Hash Brown', '', 2.00),
    ('Sweet Potato Cake', '', 2.60)
) AS product(name, description, price)
CROSS JOIN public.sale_categories cat
WHERE cat.name = 'SIDES'
ON CONFLICT (name) DO NOTHING;

-- Insert SWEET products
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    cat.id
FROM (VALUES 
    ('Pineapple Fritter', '', 4.00),
    ('Banana Fritter', '', 4.00),
    ('Hot Jam Donut', '', 1.50),
    ('6s Hot Jam Donut', '', 6.00),
    ('Mars Bar In Batter', '', 3.50),
    ('Snickers In Batter', '', 3.80)
) AS product(name, description, price)
CROSS JOIN public.sale_categories cat
WHERE cat.name = 'SWEET'
ON CONFLICT (name) DO NOTHING;

-- Insert DRINKS products with sub-categories
-- Can drinks
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id, sub_category_id) 
SELECT 
    product.name || ' (Can)',
    product.description,
    product.price,
    main_cat.id,
    sub_cat.id
FROM (VALUES 
    ('Coke', '', 3.30),
    ('Coke Zero', '', 3.30),
    ('Coke Vanilla', '', 3.30),
    ('Coke Vanilla Zero', '', 3.30),
    ('Kirks Paisto', '', 3.30),
    ('Kirks Creaming Soda', '', 3.30),
    ('Sprite', '', 3.30),
    ('Fanta', '', 3.30),
    ('Monster', '', 3.80),
    ('Pepsi Max', '', 3.30),
    ('Monster can Zero', '', 3.80)
) AS product(name, description, price)
CROSS JOIN public.sale_categories main_cat
CROSS JOIN public.sale_categories sub_cat
WHERE main_cat.name = 'DRINKS' AND sub_cat.name = 'Can' AND sub_cat.parent_category_id = main_cat.id
ON CONFLICT (name) DO NOTHING;

-- 600ml Bottle drinks
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id, sub_category_id) 
SELECT 
    product.name || ' (600ml)',
    product.description,
    product.price,
    main_cat.id,
    sub_cat.id
FROM (VALUES 
    ('Coke', '', 4.40),
    ('Coke Zero', '', 4.40),
    ('Fanta', '', 4.40),
    ('Coke Zero Vanilla', '', 4.40),
    ('Coke Vanilla', '', 4.40)
) AS product(name, description, price)
CROSS JOIN public.sale_categories main_cat
CROSS JOIN public.sale_categories sub_cat
WHERE main_cat.name = 'DRINKS' AND sub_cat.name = '600ml Bottle' AND sub_cat.parent_category_id = main_cat.id
ON CONFLICT (name) DO NOTHING;

-- 1.25l Bottle drinks
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id, sub_category_id) 
SELECT 
    product.name || ' (1.25L)',
    product.description,
    product.price,
    main_cat.id,
    sub_cat.id
FROM (VALUES 
    ('Coke', '', 5.50),
    ('Coke Zero', '', 5.50),
    ('Fanta', '', 5.50),
    ('Sprite', '', 5.50),
    ('Kirks Creaming Soda', '', 5.50),
    ('Kirks Paisto', '', 5.50),
    ('Mountain Dew', '', 5.50)
) AS product(name, description, price)
CROSS JOIN public.sale_categories main_cat
CROSS JOIN public.sale_categories sub_cat
WHERE main_cat.name = 'DRINKS' AND sub_cat.name = '1.25l Bottle' AND sub_cat.parent_category_id = main_cat.id
ON CONFLICT (name) DO NOTHING;

-- 2l Bottle drinks
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id, sub_category_id) 
SELECT 
    product.name || ' (2L)',
    product.description,
    product.price,
    main_cat.id,
    sub_cat.id
FROM (VALUES 
    ('Coke', '', 6.50),
    ('Coke Zero', '', 6.50),
    ('Fanta', '', 6.50),
    ('Sprite', '', 6.50),
    ('Mountain Dew', '', 6.50)
) AS product(name, description, price)
CROSS JOIN public.sale_categories main_cat
CROSS JOIN public.sale_categories sub_cat
WHERE main_cat.name = 'DRINKS' AND sub_cat.name = '2l Bottle' AND sub_cat.parent_category_id = main_cat.id
ON CONFLICT (name) DO NOTHING;

-- Water
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id, sub_category_id) 
SELECT 
    'Water ' || product.name,
    product.description,
    product.price,
    main_cat.id,
    sub_cat.id
FROM (VALUES 
    ('600ml', '', 2.20)
) AS product(name, description, price)
CROSS JOIN public.sale_categories main_cat
CROSS JOIN public.sale_categories sub_cat
WHERE main_cat.name = 'DRINKS' AND sub_cat.name = 'Water' AND sub_cat.parent_category_id = main_cat.id
ON CONFLICT (name) DO NOTHING;

-- Powerade Ion4
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id, sub_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    main_cat.id,
    sub_cat.id
FROM (VALUES 
    ('Powerade Red', '', 4.95),
    ('Powerade Blue', '', 4.95)
) AS product(name, description, price)
CROSS JOIN public.sale_categories main_cat
CROSS JOIN public.sale_categories sub_cat
WHERE main_cat.name = 'DRINKS' AND sub_cat.name = 'Powerade Ion4' AND sub_cat.parent_category_id = main_cat.id
ON CONFLICT (name) DO NOTHING;

-- Insert SAUCES products
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    cat.id
FROM (VALUES 
    ('Tartare Sauce', '', 2.00),
    ('Ketchup', '', 2.00),
    ('Garlic Aioli', '', 2.00),
    ('Peri Peri Sauce', '', 2.00)
) AS product(name, description, price)
CROSS JOIN public.sale_categories cat
WHERE cat.name = 'SAUCES'
ON CONFLICT (name) DO NOTHING;

-- Insert ALL DAY BREAKFAST products
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id) 
SELECT 
    product.name,
    product.description,
    product.price,
    cat.id
FROM (VALUES 
    ('Egg And Bacon Bun', '2 pieces of bacon with fried egg wrapped with tomato sauce in a delicious bun', 6.50),
    ('Egg And Bacon Sandwich', '2 pieces of bacon with fried egg and tomato sauce in super thick white bread', 6.50)
) AS product(name, description, price)
CROSS JOIN public.sale_categories cat
WHERE cat.name = 'ALL DAY BREAKFAST'
ON CONFLICT (name) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE public.sale_categories IS 'Menu categories and sub-categories for organizing sale products';
COMMENT ON TABLE public.sale_products IS 'Menu items with support for main categories and sub-categories';

-- Create a view for easy menu browsing with hierarchy
CREATE OR REPLACE VIEW public.menu_with_hierarchy AS
SELECT 
    sp.id as product_id,
    sp.name as product_name,
    sp.description as product_description,
    sp.sale_price,
    sp.image_url,
    sp.is_active,
    sp.preparation_time_minutes,
    main_cat.id as main_category_id,
    main_cat.name as main_category_name,
    main_cat.sort_order as main_category_sort,
    sub_cat.id as sub_category_id,
    sub_cat.name as sub_category_name,
    sub_cat.sort_order as sub_category_sort,
    sp.created_at,
    sp.updated_at
FROM public.sale_products sp
LEFT JOIN public.sale_categories main_cat ON sp.sale_category_id = main_cat.id
LEFT JOIN public.sale_categories sub_cat ON sp.sub_category_id = sub_cat.id
WHERE sp.is_active = true
ORDER BY 
    COALESCE(main_cat.sort_order, 999),
    COALESCE(sub_cat.sort_order, 999),
    sp.name;

-- Grant access to the view
GRANT SELECT ON public.menu_with_hierarchy TO authenticated;
GRANT SELECT ON public.menu_with_hierarchy TO anon;
