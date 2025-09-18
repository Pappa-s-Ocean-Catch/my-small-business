create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.settings enable row level security;

-- Everyone can read settings
drop policy if exists settings_read_all on public.settings;
create policy settings_read_all on public.settings for select using (true);

-- Only admins can write settings
drop policy if exists settings_admin_write on public.settings;
drop policy if exists settings_admin_update on public.settings;
drop policy if exists settings_admin_delete on public.settings;
create policy settings_admin_write on public.settings for insert with check (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy settings_admin_update on public.settings for update using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);
create policy settings_admin_delete on public.settings for delete using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role_slug = 'admin')
);

insert into public.settings (key, value)
values ('defaults', jsonb_build_object('pay_rate', 0))
on conflict (key) do nothing;


