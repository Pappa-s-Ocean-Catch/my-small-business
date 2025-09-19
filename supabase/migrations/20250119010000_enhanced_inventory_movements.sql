-- Enhanced Inventory Movements System
-- This migration adds comprehensive inventory tracking with COGS calculation

-- Create inventory_movements table for detailed tracking
create table if not exists public.inventory_movements (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  movement_type text not null check (movement_type in ('purchase', 'consumption', 'adjustment', 'return', 'transfer')),
  quantity_change integer not null, -- positive for purchase, negative for consumption
  unit_cost decimal(10,2), -- cost per unit for this movement
  total_cost decimal(10,2), -- total cost for this movement
  previous_quantity integer not null,
  new_quantity integer not null,
  reason text,
  reference text, -- purchase order number, invoice number, etc.
  notes text,
  movement_date timestamp with time zone default now(),
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create index for better performance
create index if not exists idx_inventory_movements_product_id on public.inventory_movements(product_id);
create index if not exists idx_inventory_movements_movement_type on public.inventory_movements(movement_type);
create index if not exists idx_inventory_movements_movement_date on public.inventory_movements(movement_date);
create index if not exists idx_inventory_movements_created_by on public.inventory_movements(created_by);

-- Enable RLS
alter table public.inventory_movements enable row level security;

-- RLS Policies for inventory_movements
drop policy if exists inventory_movements_read_all on public.inventory_movements;
create policy inventory_movements_read_all on public.inventory_movements for select using (true);

drop policy if exists inventory_movements_admin_write on public.inventory_movements;
create policy inventory_movements_admin_write on public.inventory_movements for all using (
  exists (
    select 1 from public.profiles 
    where profiles.id = auth.uid() 
    and profiles.role_slug = 'admin'
  )
);

-- Create inventory_financial_summary view for COGS and financial tracking
create or replace view public.inventory_financial_summary as
select 
  p.id as product_id,
  p.name as product_name,
  p.sku,
  p.quantity_in_stock,
  p.purchase_price,
  p.sale_price,
  -- Calculate average cost from purchases
  coalesce(
    (select avg(unit_cost) 
     from public.inventory_movements 
     where product_id = p.id 
     and movement_type = 'purchase' 
     and unit_cost is not null), 
    p.purchase_price
  ) as average_cost,
  -- Calculate total cost of current inventory
  p.quantity_in_stock * coalesce(
    (select avg(unit_cost) 
     from public.inventory_movements 
     where product_id = p.id 
     and movement_type = 'purchase' 
     and unit_cost is not null), 
    p.purchase_price
  ) as inventory_value,
  -- Calculate total purchases (quantity and cost)
  coalesce(
    (select sum(quantity_change) 
     from public.inventory_movements 
     where product_id = p.id 
     and movement_type = 'purchase'), 
    0
  ) as total_purchased_quantity,
  coalesce(
    (select sum(total_cost) 
     from public.inventory_movements 
     where product_id = p.id 
     and movement_type = 'purchase' 
     and total_cost is not null), 
    0
  ) as total_purchase_cost,
  -- Calculate total consumption (quantity and cost)
  coalesce(
    (select abs(sum(quantity_change)) 
     from public.inventory_movements 
     where product_id = p.id 
     and movement_type = 'consumption'), 
    0
  ) as total_consumed_quantity,
  coalesce(
    (select sum(abs(quantity_change) * unit_cost) 
     from public.inventory_movements 
     where product_id = p.id 
     and movement_type = 'consumption' 
     and unit_cost is not null), 
    0
  ) as total_cogs,
  -- Calculate profit margin
  (p.sale_price - coalesce(
    (select avg(unit_cost) 
     from public.inventory_movements 
     where product_id = p.id 
     and movement_type = 'purchase' 
     and unit_cost is not null), 
    p.purchase_price
  )) as profit_per_unit,
  -- Calculate potential revenue from current stock
  p.quantity_in_stock * p.sale_price as potential_revenue
from public.products p
where p.is_active = true;

-- Create inventory_movement_summary view for chart data
create or replace view public.inventory_movement_summary as
select 
  date_trunc('day', movement_date) as movement_date,
  movement_type,
  sum(quantity_change) as total_quantity_change,
  sum(total_cost) as total_cost,
  count(*) as movement_count
from public.inventory_movements
group by date_trunc('day', movement_date), movement_type
order by movement_date desc;

-- Create function to update product quantity when movement is created
create or replace function public.update_product_quantity_on_movement()
returns trigger as $$
begin
  -- Update the product's quantity_in_stock
  update public.products 
  set 
    quantity_in_stock = new.new_quantity,
    updated_at = now()
  where id = new.product_id;
  
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update product quantity
drop trigger if exists trigger_update_product_quantity on public.inventory_movements;
create trigger trigger_update_product_quantity
  after insert on public.inventory_movements
  for each row
  execute function public.update_product_quantity_on_movement();

-- Create function to calculate COGS for consumption movements
create or replace function public.calculate_cogs_for_consumption()
returns trigger as $$
declare
  avg_cost decimal(10,2);
begin
  -- If this is a consumption movement and no unit_cost is provided, calculate it
  if new.movement_type = 'consumption' and new.unit_cost is null then
    -- Get average cost from purchases
    select avg(unit_cost) into avg_cost
    from public.inventory_movements 
    where product_id = new.product_id 
    and movement_type = 'purchase' 
    and unit_cost is not null;
    
    -- If no purchase history, use product's purchase_price
    if avg_cost is null then
      select purchase_price into avg_cost
      from public.products 
      where id = new.product_id;
    end if;
    
    -- Set unit_cost and total_cost
    new.unit_cost := avg_cost;
    new.total_cost := abs(new.quantity_change) * avg_cost;
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Create trigger to calculate COGS
drop trigger if exists trigger_calculate_cogs on public.inventory_movements;
create trigger trigger_calculate_cogs
  before insert on public.inventory_movements
  for each row
  execute function public.calculate_cogs_for_consumption();

-- Create function to validate movement quantities
create or replace function public.validate_movement_quantity()
returns trigger as $$
begin
  -- Ensure consumption doesn't exceed available stock
  if new.movement_type = 'consumption' and new.quantity_change > 0 then
    new.quantity_change := -new.quantity_change; -- Make consumption negative
  end if;
  
  -- Ensure purchase is positive
  if new.movement_type = 'purchase' and new.quantity_change < 0 then
    new.quantity_change := abs(new.quantity_change); -- Make purchase positive
  end if;
  
  -- Calculate new quantity
  new.new_quantity := new.previous_quantity + new.quantity_change;
  
  -- Ensure new quantity is not negative
  if new.new_quantity < 0 then
    raise exception 'Insufficient stock. Available: %, Requested: %', 
      new.previous_quantity, abs(new.quantity_change);
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Create trigger to validate quantities
drop trigger if exists trigger_validate_movement_quantity on public.inventory_movements;
create trigger trigger_validate_movement_quantity
  before insert on public.inventory_movements
  for each row
  execute function public.validate_movement_quantity();

-- Update existing stock_movements to use new structure (if any exist)
-- This is a migration step to move from old stock_movements to new inventory_movements
insert into public.inventory_movements (
  product_id, 
  movement_type, 
  quantity_change, 
  previous_quantity, 
  new_quantity, 
  reason, 
  notes, 
  created_at
)
select 
  product_id,
  case 
    when movement_type = 'in' then 'purchase'
    when movement_type = 'out' then 'consumption'
    else 'adjustment'
  end as movement_type,
  case 
    when movement_type = 'in' then quantity_change
    when movement_type = 'out' then -quantity_change
    else quantity_change
  end as quantity_change,
  previous_quantity,
  new_quantity,
  reason,
  notes,
  created_at
from public.stock_movements
where not exists (
  select 1 from public.inventory_movements 
  where inventory_movements.product_id = stock_movements.product_id
  and inventory_movements.created_at = stock_movements.created_at
);

-- Add updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_inventory_movements_updated_at on public.inventory_movements;
create trigger trigger_update_inventory_movements_updated_at
  before update on public.inventory_movements
  for each row
  execute function public.update_updated_at_column();
