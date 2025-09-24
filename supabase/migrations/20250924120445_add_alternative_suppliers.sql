-- Add alternative suppliers table for products
-- This allows products to have multiple alternative suppliers in addition to the primary supplier

CREATE TABLE IF NOT EXISTS public.product_alternative_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  
  -- Ensure unique combination of product and supplier
  UNIQUE(product_id, supplier_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_alternative_suppliers_product_id 
ON public.product_alternative_suppliers(product_id);

CREATE INDEX IF NOT EXISTS idx_product_alternative_suppliers_supplier_id 
ON public.product_alternative_suppliers(supplier_id);

-- Add RLS policies
ALTER TABLE public.product_alternative_suppliers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view alternative suppliers for products they can view
CREATE POLICY "Users can view alternative suppliers" ON public.product_alternative_suppliers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products 
      WHERE products.id = product_alternative_suppliers.product_id
    )
  );

-- Policy: Only admins can manage alternative suppliers
CREATE POLICY "Admins can manage alternative suppliers" ON public.product_alternative_suppliers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role_slug = 'admin'
    )
  );

-- Add comments
COMMENT ON TABLE public.product_alternative_suppliers IS 'Alternative suppliers for products. Each product can have multiple alternative suppliers in addition to the primary supplier.';
COMMENT ON COLUMN public.product_alternative_suppliers.product_id IS 'Reference to the product';
COMMENT ON COLUMN public.product_alternative_suppliers.supplier_id IS 'Reference to the alternative supplier';
COMMENT ON COLUMN public.product_alternative_suppliers.created_by IS 'User who added this alternative supplier';
