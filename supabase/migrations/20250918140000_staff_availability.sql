-- Add staff availability table for day/time slot configuration

create table if not exists public.staff_availability (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.staff(id) on delete cascade,
  day_of_week integer not null check (day_of_week >= 0 and day_of_week <= 6), -- 0=Sunday, 1=Monday, etc
  start_time time not null,
  end_time time not null,
  created_at timestamptz default now(),
  constraint end_after_start check (end_time > start_time)
);

-- RLS
alter table public.staff_availability enable row level security;

-- Policies: read all, admin write
drop policy if exists staff_availability_read_all on public.staff_availability;
drop policy if exists staff_availability_admin_ins on public.staff_availability;
drop policy if exists staff_availability_admin_upd on public.staff_availability;
drop policy if exists staff_availability_admin_del on public.staff_availability;

create policy staff_availability_read_all on public.staff_availability for select using (true);
create policy staff_availability_admin_ins on public.staff_availability for insert with check (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy staff_availability_admin_upd on public.staff_availability for update using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy staff_availability_admin_del on public.staff_availability for delete using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);

-- Index for efficient queries
create index if not exists idx_staff_availability_staff_day on public.staff_availability(staff_id, day_of_week);
