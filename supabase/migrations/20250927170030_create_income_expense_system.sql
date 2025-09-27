-- Create transaction_categories table
CREATE TABLE IF NOT EXISTS public.transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  color TEXT DEFAULT '#3B82F6',
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank', 'card')),
  description TEXT,
  reference_number TEXT, -- For receipts, invoices, bill IDs, etc.
  document_url TEXT, -- For attached documents
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON public.transactions(payment_method);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON public.transactions(created_by);

-- Insert default categories
INSERT INTO public.transaction_categories (name, type, color, icon) VALUES
-- Income Categories
('Sales', 'income', '#10B981', 'FaShoppingCart'),
('Other Income', 'income', '#3B82F6', 'FaPlus'),
-- Expense Categories  
('Purchase', 'expense', '#F59E0B', 'FaShoppingBag'),
('Pay Bill', 'expense', '#EF4444', 'FaFileInvoice'),
('Rent', 'expense', '#8B5CF6', 'FaBuilding'),
('Wages', 'expense', '#06B6D4', 'FaUsers'),
('Utilities', 'expense', '#F97316', 'FaBolt'),
('Marketing', 'expense', '#EC4899', 'FaBullhorn'),
('Equipment', 'expense', '#6366F1', 'FaTools'),
('Other Expense', 'expense', '#6B7280', 'FaMinus')
ON CONFLICT (name) DO NOTHING;

-- Add RLS policies
ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for transaction_categories (admin only)
CREATE POLICY "Only admins can manage transaction categories" ON public.transaction_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role_slug = 'admin'
    )
  );

-- RLS policies for transactions (admin can manage all, users can view)
CREATE POLICY "Admins can manage all transactions" ON public.transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role_slug = 'admin'
    )
  );

CREATE POLICY "Users can view transactions" ON public.transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE public.transaction_categories IS 'Categories for income and expense transactions';
COMMENT ON TABLE public.transactions IS 'Income and expense transaction records';
COMMENT ON COLUMN public.transactions.reference_number IS 'Invoice number, bill ID, receipt number, etc.';
COMMENT ON COLUMN public.transactions.document_url IS 'URL to attached document (receipt, invoice, etc.)';
