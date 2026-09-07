CREATE POLICY "Staff can update phone_call_history" ON phone_call_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff can delete phone_call_history" ON phone_call_history FOR DELETE TO authenticated USING (true);
