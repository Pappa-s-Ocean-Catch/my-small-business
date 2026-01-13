-- Enable realtime for orders table
-- This allows the admin orders page to receive real-time updates when new orders are created

-- Enable realtime publication for orders table
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Set replica identity to FULL for better realtime updates
-- This ensures all column changes are captured
ALTER TABLE public.orders REPLICA IDENTITY FULL;
