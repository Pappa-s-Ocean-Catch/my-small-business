-- SQL script to generate random income and expense data for testing Cash Flow Analysis
-- Run this directly in your Supabase SQL editor or psql

-- First, let's check if we have any existing transactions
-- SELECT COUNT(*) FROM transactions;

-- If you want to clear existing test data first, uncomment the line below:
-- DELETE FROM transactions WHERE created_at > NOW() - INTERVAL '1 day';

-- Generate test transactions for current week (September 22-29, 2025)
-- This creates realistic income and expense data with various categories

INSERT INTO transactions (date, type, category, amount, payment_method, description, reference_number, created_by)
VALUES 
-- Sunday, September 22, 2025
('2025-09-22', 'income', 'Sales', 320.50, 'cash', 'Sunday sales revenue', 'REF-2201', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-22', 'income', 'Delivery', 185.25, 'card', 'Sunday delivery orders', 'REF-2202', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-22', 'expense', 'Wages', 450.00, 'bank', 'Sunday staff wages', 'REF-2203', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-22', 'expense', 'Utilities', 95.50, 'bank', 'Electricity bill', 'REF-2204', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),

-- Monday, September 23, 2025
('2025-09-23', 'income', 'Sales', 485.75, 'cash', 'Monday sales revenue', 'REF-2301', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-23', 'income', 'Catering', 650.00, 'bank', 'Corporate lunch catering', 'REF-2302', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-23', 'income', 'Online Orders', 220.40, 'bank', 'Online delivery orders', 'REF-2303', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-23', 'expense', 'Purchase', 125.80, 'bank', 'Grocery supplies', 'REF-2304', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-23', 'expense', 'Wages', 680.00, 'bank', 'Monday staff wages', 'REF-2305', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-23', 'expense', 'Marketing', 150.00, 'card', 'Social media advertising', 'REF-2306', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),

-- Tuesday, September 24, 2025
('2025-09-24', 'income', 'Sales', 420.60, 'cash', 'Tuesday sales revenue', 'REF-2401', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-24', 'income', 'Catering', 480.00, 'bank', 'Office catering', 'REF-2402', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-24', 'income', 'Delivery', 165.30, 'card', 'Tuesday delivery orders', 'REF-2403', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-24', 'expense', 'Equipment', 320.00, 'bank', 'Kitchen equipment maintenance', 'REF-2404', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-24', 'expense', 'Wages', 720.00, 'bank', 'Tuesday staff wages', 'REF-2405', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-24', 'expense', 'Supplies', 85.50, 'cash', 'Cleaning supplies', 'REF-2406', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),

-- Wednesday, September 25, 2025
('2025-09-25', 'income', 'Sales', 380.25, 'cash', 'Wednesday sales revenue', 'REF-2501', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-25', 'income', 'Catering', 750.00, 'bank', 'Wedding catering deposit', 'REF-2502', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-25', 'income', 'Other Income', 200.00, 'cash', 'Special event booking', 'REF-2503', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-25', 'expense', 'Rent', 2500.00, 'bank', 'Monthly rent payment', 'REF-2504', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-25', 'expense', 'Wages', 650.00, 'bank', 'Wednesday staff wages', 'REF-2505', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-25', 'expense', 'Insurance', 280.00, 'bank', 'Business insurance premium', 'REF-2506', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),

-- Thursday, September 26, 2025
('2025-09-26', 'income', 'Sales', 450.80, 'cash', 'Thursday sales revenue', 'REF-2601', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-26', 'income', 'Delivery', 195.60, 'card', 'Thursday delivery orders', 'REF-2602', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-26', 'income', 'Online Orders', 310.40, 'bank', 'Online takeaway orders', 'REF-2603', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-26', 'expense', 'Utilities', 180.75, 'bank', 'Gas bill', 'REF-2604', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-26', 'expense', 'Wages', 750.00, 'bank', 'Thursday staff wages', 'REF-2605', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-26', 'expense', 'Maintenance', 120.00, 'bank', 'Equipment repair', 'REF-2606', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),

-- Friday, September 27, 2025
('2025-09-27', 'income', 'Sales', 520.75, 'cash', 'Friday sales revenue', 'REF-2701', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-27', 'income', 'Catering', 420.00, 'bank', 'Friday corporate catering', 'REF-2702', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-27', 'income', 'Delivery', 225.30, 'card', 'Friday delivery orders', 'REF-2703', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-27', 'expense', 'Purchase', 145.50, 'bank', 'Weekend grocery supplies', 'REF-2704', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-27', 'expense', 'Wages', 800.00, 'bank', 'Friday staff wages', 'REF-2705', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-27', 'expense', 'Marketing', 200.00, 'card', 'Weekend promotion', 'REF-2706', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),

-- Saturday, September 28, 2025
('2025-09-28', 'income', 'Sales', 680.40, 'cash', 'Saturday sales revenue', 'REF-2801', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-28', 'income', 'Catering', 850.00, 'bank', 'Saturday event catering', 'REF-2802', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-28', 'income', 'Delivery', 185.75, 'card', 'Saturday delivery orders', 'REF-2803', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-28', 'expense', 'Wages', 950.00, 'bank', 'Saturday staff wages', 'REF-2804', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-28', 'expense', 'Supplies', 95.25, 'cash', 'Weekend supplies', 'REF-2805', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-28', 'expense', 'Equipment', 180.00, 'bank', 'POS system maintenance', 'REF-2806', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),

-- Sunday, September 29, 2025
('2025-09-29', 'income', 'Sales', 425.60, 'cash', 'Sunday sales revenue', 'REF-2901', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-29', 'income', 'Delivery', 165.40, 'card', 'Sunday delivery orders', 'REF-2902', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-29', 'income', 'Other Income', 150.00, 'cash', 'Sunday special event', 'REF-2903', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-29', 'expense', 'Wages', 480.00, 'bank', 'Sunday staff wages', 'REF-2904', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1)),
('2025-09-29', 'expense', 'Utilities', 75.50, 'bank', 'Internet bill', 'REF-2905', (SELECT id FROM profiles WHERE role_slug = 'admin' LIMIT 1));

-- Check the inserted data
SELECT 
  type,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount,
  AVG(amount) as average_amount
FROM transactions 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY type
ORDER BY type;
