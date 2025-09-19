-- Shop Management System Database Schema
-- This migration creates tables for products, categories, suppliers, and inventory management

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Categories table
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Suppliers table
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Products table
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique not null,
  category_id uuid references public.categories(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  purchase_price decimal(10,2) not null default 0,
  sale_price decimal(10,2) not null default 0,
  quantity_in_stock integer not null default 0,
  reorder_level integer not null default 0,
  image_url text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Stock movements table for tracking inventory changes
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  movement_type text not null check (movement_type in ('in', 'out', 'adjustment')),
  quantity_change integer not null, -- positive for in, negative for out
  previous_quantity integer not null,
  new_quantity integer not null,
  reason text, -- e.g., 'Purchase Order', 'Sale', 'Damaged Goods', 'Manual Adjustment'
  reference text, -- e.g., 'PO-2024-001', 'Sale-123', 'Adjustment-001'
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Low stock notifications table
create table if not exists public.low_stock_notifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  current_quantity integer not null,
  reorder_level integer not null,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Enable RLS on all tables
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.low_stock_notifications enable row level security;

-- Categories policies: read all, admin write
drop policy if exists categories_read_all on public.categories;
drop policy if exists categories_admin_ins on public.categories;
drop policy if exists categories_admin_upd on public.categories;
drop policy if exists categories_admin_del on public.categories;

create policy categories_read_all on public.categories for select using (true);
create policy categories_admin_ins on public.categories for insert with check (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy categories_admin_upd on public.categories for update using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy categories_admin_del on public.categories for delete using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);

-- Suppliers policies: read all, admin write
drop policy if exists suppliers_read_all on public.suppliers;
drop policy if exists suppliers_admin_ins on public.suppliers;
drop policy if exists suppliers_admin_upd on public.suppliers;
drop policy if exists suppliers_admin_del on public.suppliers;

create policy suppliers_read_all on public.suppliers for select using (true);
create policy suppliers_admin_ins on public.suppliers for insert with check (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy suppliers_admin_upd on public.suppliers for update using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy suppliers_admin_del on public.suppliers for delete using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);

-- Products policies: read all, admin write
drop policy if exists products_read_all on public.products;
drop policy if exists products_admin_ins on public.products;
drop policy if exists products_admin_upd on public.products;
drop policy if exists products_admin_del on public.products;

create policy products_read_all on public.products for select using (true);
create policy products_admin_ins on public.products for insert with check (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy products_admin_upd on public.products for update using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy products_admin_del on public.products for delete using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);

-- Stock movements policies: read all, admin write
drop policy if exists stock_movements_read_all on public.stock_movements;
drop policy if exists stock_movements_admin_ins on public.stock_movements;
drop policy if exists stock_movements_admin_upd on public.stock_movements;
drop policy if exists stock_movements_admin_del on public.stock_movements;

create policy stock_movements_read_all on public.stock_movements for select using (true);
create policy stock_movements_admin_ins on public.stock_movements for insert with check (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy stock_movements_admin_upd on public.stock_movements for update using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy stock_movements_admin_del on public.stock_movements for delete using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);

-- Low stock notifications policies: read all, admin write
drop policy if exists low_stock_notifications_read_all on public.low_stock_notifications;
drop policy if exists low_stock_notifications_admin_ins on public.low_stock_notifications;
drop policy if exists low_stock_notifications_admin_upd on public.low_stock_notifications;
drop policy if exists low_stock_notifications_admin_del on public.low_stock_notifications;

create policy low_stock_notifications_read_all on public.low_stock_notifications for select using (true);
create policy low_stock_notifications_admin_ins on public.low_stock_notifications for insert with check (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy low_stock_notifications_admin_upd on public.low_stock_notifications for update using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy low_stock_notifications_admin_del on public.low_stock_notifications for delete using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);

-- Create indexes for better performance
create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_products_supplier_id on public.products(supplier_id);
create index if not exists idx_products_sku on public.products(sku);
create index if not exists idx_products_quantity on public.products(quantity_in_stock);
create index if not exists idx_stock_movements_product_id on public.stock_movements(product_id);
create index if not exists idx_stock_movements_created_at on public.stock_movements(created_at);
create index if not exists idx_low_stock_notifications_product_id on public.low_stock_notifications(product_id);
create index if not exists idx_low_stock_notifications_resolved on public.low_stock_notifications(is_resolved);

-- Function to automatically create stock movement when product quantity changes
create or replace function public.handle_product_quantity_change()
returns trigger as $$
begin
  -- Only create movement if quantity actually changed
  if old.quantity_in_stock != new.quantity_in_stock then
    insert into public.stock_movements (
      product_id,
      movement_type,
      quantity_change,
      previous_quantity,
      new_quantity,
      reason,
      created_by
    ) values (
      new.id,
      case 
        when new.quantity_in_stock > old.quantity_in_stock then 'in'
        when new.quantity_in_stock < old.quantity_in_stock then 'out'
        else 'adjustment'
      end,
      new.quantity_in_stock - old.quantity_in_stock,
      old.quantity_in_stock,
      new.quantity_in_stock,
      'Product quantity updated',
      auth.uid()
    );
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call the function on product quantity updates
drop trigger if exists on_product_quantity_change on public.products;
create trigger on_product_quantity_change
  after update on public.products
  for each row execute function public.handle_product_quantity_change();

-- Function to check for low stock and create notifications
create or replace function public.check_low_stock()
returns trigger as $$
begin
  -- Check if quantity is at or below reorder level
  if new.quantity_in_stock <= new.reorder_level then
    -- Only create notification if there isn't already an unresolved one
    if not exists (
      select 1 from public.low_stock_notifications 
      where product_id = new.id and is_resolved = false
    ) then
      insert into public.low_stock_notifications (
        product_id,
        current_quantity,
        reorder_level
      ) values (
        new.id,
        new.quantity_in_stock,
        new.reorder_level
      );
    end if;
  else
    -- If quantity is above reorder level, resolve any existing notifications
    update public.low_stock_notifications 
    set is_resolved = true, resolved_at = now(), resolved_by = auth.uid()
    where product_id = new.id and is_resolved = false;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to check for low stock on product updates
drop trigger if exists on_product_low_stock_check on public.products;
create trigger on_product_low_stock_check
  after update on public.products
  for each row execute function public.check_low_stock();

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Add updated_at triggers
drop trigger if exists update_categories_updated_at on public.categories;
create trigger update_categories_updated_at before update on public.categories for each row execute function public.update_updated_at_column();

drop trigger if exists update_suppliers_updated_at on public.suppliers;
create trigger update_suppliers_updated_at before update on public.suppliers for each row execute function public.update_updated_at_column();

drop trigger if exists update_products_updated_at on public.products;
create trigger update_products_updated_at before update on public.products for each row execute function public.update_updated_at_column();
