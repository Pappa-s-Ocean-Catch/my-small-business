CREATE TABLE phone_call_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    caller_number TEXT NOT NULL,
    caller_name TEXT,
    call_id TEXT,
    status TEXT DEFAULT 'missed' -- 'missed', 'accepted'
);

ALTER TABLE phone_call_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view phone_call_history" ON phone_call_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert phone_call_history" ON phone_call_history FOR INSERT TO authenticated WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE phone_call_history;
