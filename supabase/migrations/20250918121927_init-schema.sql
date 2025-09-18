-- Enable RLS
-- Tables: profiles (users), roles, staff, shifts

-- Ensure required extensions
create extension if not exists pgcrypto;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug in ('admin','staff')),
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key, -- matches auth.users.id
  email text unique,
  full_name text,
  role_slug text references public.roles(slug) default 'staff',
  created_at timestamptz default now()
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  pay_rate numeric(10,2) not null default 0,
  is_available boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.staff(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  constraint end_after_start check (end_time > start_time)
);

-- RLS
alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.shifts enable row level security;

-- Policies: profiles are readable by self and admins
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select using (
  auth.uid() = id or exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);

-- Staff policies: admin full access, others read-only
drop policy if exists staff_read_all on public.staff;
drop policy if exists staff_admin_ins on public.staff;
drop policy if exists staff_admin_upd on public.staff;
drop policy if exists staff_admin_del on public.staff;
create policy staff_read_all on public.staff for select using (true);
create policy staff_admin_ins on public.staff for insert with check (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy staff_admin_upd on public.staff for update using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy staff_admin_del on public.staff for delete using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);

-- Shifts policies: read all, admin write
drop policy if exists shifts_read_all on public.shifts;
drop policy if exists shifts_admin_ins on public.shifts;
drop policy if exists shifts_admin_upd on public.shifts;
drop policy if exists shifts_admin_del on public.shifts;
create policy shifts_read_all on public.shifts for select using (true);
create policy shifts_admin_ins on public.shifts for insert with check (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy shifts_admin_upd on public.shifts for update using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy shifts_admin_del on public.shifts for delete using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);

-- Seed roles
insert into public.roles (slug) values ('admin') on conflict do nothing;
insert into public.roles (slug) values ('staff') on conflict do nothing;


