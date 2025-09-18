-- Add staff roles and description fields

-- First create the roles table
create table if not exists public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug in ('member','leader','manager')),
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- Add role and description columns to staff table (without default first)
alter table public.staff 
add column if not exists role_slug text,
add column if not exists description text;

-- RLS for staff_roles
alter table public.staff_roles enable row level security;

-- Policies for staff_roles: read all, admin write
drop policy if exists staff_roles_read_all on public.staff_roles;
drop policy if exists staff_roles_admin_write on public.staff_roles;

create policy staff_roles_read_all on public.staff_roles for select using (true);
create policy staff_roles_admin_write on public.staff_roles for insert with check (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy staff_roles_admin_update on public.staff_roles for update using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy staff_roles_admin_delete on public.staff_roles for delete using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);

-- Seed default roles
insert into public.staff_roles (slug, name, description) values 
('member', 'Member', 'Regular staff member'),
('leader', 'Leader', 'Team leader with supervisory responsibilities'),
('manager', 'Manager', 'Department manager with full oversight')
on conflict (slug) do nothing;

-- Now add the foreign key constraint and set default values
alter table public.staff 
add constraint staff_role_slug_fkey foreign key (role_slug) references public.staff_roles(slug);

-- Update existing staff to have 'member' role
update public.staff set role_slug = 'member' where role_slug is null;

-- Set default for future inserts
alter table public.staff alter column role_slug set default 'member';
