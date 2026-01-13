-- Enable realtime for orders table
-- This allows the admin orders page to receive real-time updates when new orders are created

-- Enable realtime publication for orders table (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'orders'
    AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;

-- Set replica identity to FULL for better realtime updates
-- This ensures all column changes are captured
ALTER TABLE public.orders REPLICA IDENTITY FULL;
