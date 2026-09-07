ALTER TABLE phone_call_history ADD COLUMN customer_id UUID REFERENCES profiles(id);
