-- Shift Templates for weekly calendar setups

-- 1) Table
create table if not exists public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  calendar jsonb not null,
  created_by uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);

-- 2) Enable RLS
alter table public.shift_templates enable row level security;

-- 3) Policies: admins manage all, others read-only if needed
drop policy if exists shift_templates_admin_all on public.shift_templates;
create policy shift_templates_admin_all on public.shift_templates
  for all using (
    exists (
      select 1 from public.profiles 
      where profiles.id = auth.uid() 
      and profiles.role_slug = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles 
      where profiles.id = auth.uid() 
      and profiles.role_slug = 'admin'
    )
  );

-- Optional: allow select to non-admins (commented out by default)
-- create policy shift_templates_read_on_select on public.shift_templates
--   for select using (true);

-- 4) Helpful indexes
create index if not exists idx_shift_templates_created_at on public.shift_templates(created_at desc);
create index if not exists idx_shift_templates_created_by on public.shift_templates(created_by);

-- 5) Basic constraint to ensure calendar has expected keys at least as an object
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shift_templates_calendar_is_object'
  ) then
    alter table public.shift_templates
      add constraint shift_templates_calendar_is_object
      check (jsonb_typeof(calendar) = 'object');
  end if;
end $$;


