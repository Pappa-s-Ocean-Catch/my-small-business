-- Add threshold fields to products table for better inventory management
-- This migration adds warning_threshold and alert_threshold fields

-- Add threshold columns to products table
alter table public.products 
add column if not exists warning_threshold integer default 10,
add column if not exists alert_threshold integer default 5;

-- Add comments for documentation
comment on column public.products.warning_threshold is 'Stock level that triggers a warning (yellow alert)';
comment on column public.products.alert_threshold is 'Stock level that triggers a critical alert (red alert)';

-- Update existing products to have reasonable default thresholds
-- Set warning_threshold to 2x reorder_level and alert_threshold to reorder_level
update public.products 
set 
  warning_threshold = case 
    when reorder_level > 0 then reorder_level * 2
    else 10
  end,
  alert_threshold = case 
    when reorder_level > 0 then reorder_level
    else 5
  end
where warning_threshold is null or alert_threshold is null;

-- Add check constraints to ensure thresholds are positive
alter table public.products 
add constraint products_warning_threshold_positive 
check (warning_threshold >= 0);

alter table public.products 
add constraint products_alert_threshold_positive 
check (alert_threshold >= 0);

-- Add constraint to ensure warning_threshold >= alert_threshold
alter table public.products 
add constraint products_thresholds_logical 
check (warning_threshold >= alert_threshold);

-- Create function to get product stock status based on thresholds
create or replace function public.get_product_stock_status(
  current_stock integer,
  warning_threshold integer,
  alert_threshold integer
)
returns text as $$
begin
  if current_stock <= alert_threshold then
    return 'critical';
  elsif current_stock <= warning_threshold then
    return 'warning';
  else
    return 'good';
  end if;
end;
$$ language plpgsql;

-- Create view for products with stock status
create or replace view public.products_with_stock_status as
select 
  p.*,
  public.get_product_stock_status(
    p.quantity_in_stock, 
    p.warning_threshold, 
    p.alert_threshold
  ) as stock_status
from public.products p
where p.is_active = true;

-- Create function to get threshold-based alerts
create or replace function public.get_threshold_alerts()
returns table (
  product_id uuid,
  product_name text,
  sku text,
  current_stock integer,
  warning_threshold integer,
  alert_threshold integer,
  stock_status text,
  alert_type text
) as $$
begin
  return query
  select 
    p.id as product_id,
    p.name as product_name,
    p.sku,
    p.quantity_in_stock as current_stock,
    p.warning_threshold,
    p.alert_threshold,
    public.get_product_stock_status(
      p.quantity_in_stock, 
      p.warning_threshold, 
      p.alert_threshold
    ) as stock_status,
    case 
      when p.quantity_in_stock <= p.alert_threshold then 'critical'
      when p.quantity_in_stock <= p.warning_threshold then 'warning'
      else null
    end as alert_type
  from public.products p
  where p.is_active = true
  and (
    p.quantity_in_stock <= p.warning_threshold
  )
  order by 
    case 
      when p.quantity_in_stock <= p.alert_threshold then 1
      when p.quantity_in_stock <= p.warning_threshold then 2
      else 3
    end,
    p.name;
end;
$$ language plpgsql;
