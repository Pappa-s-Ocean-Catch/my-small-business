-- Add delivery_instructions to delivery_addresses table
ALTER TABLE delivery_addresses ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;

-- Add delivery_instructions to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;

-- Add comments for documentation
COMMENT ON COLUMN delivery_addresses.delivery_instructions IS 'Specific delivery notes for this address (e.g. gate code, leave at door)';
COMMENT ON COLUMN orders.delivery_instructions IS 'Specific delivery notes for this order, captured at checkout';
