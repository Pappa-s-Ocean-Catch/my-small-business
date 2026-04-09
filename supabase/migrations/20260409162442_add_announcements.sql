-- Migration: 20260409162442_add_announcements.sql

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  image_url text,
  action_button_text text,
  action_button_link text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  priority integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_end_after_start check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index if not exists idx_announcements_status on public.announcements(status);
create index if not exists idx_announcements_starts_at on public.announcements(starts_at);
create index if not exists idx_announcements_ends_at on public.announcements(ends_at);
create index if not exists idx_announcements_priority on public.announcements(priority);

alter table public.announcements enable row level security;

-- Public read: only "published" announcements within time window
drop policy if exists announcements_public_read on public.announcements;
create policy announcements_public_read
on public.announcements
for select
using (
  status = 'published'
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

-- Admin full access
drop policy if exists announcements_admin_ins on public.announcements;
drop policy if exists announcements_admin_upd on public.announcements;
drop policy if exists announcements_admin_del on public.announcements;
drop policy if exists announcements_admin_read on public.announcements;

create policy announcements_admin_read
on public.announcements
for select
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role_slug = 'admin'
  )
);

create policy announcements_admin_ins
on public.announcements
for insert
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role_slug = 'admin'
  )
);

create policy announcements_admin_upd
on public.announcements
for update
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role_slug = 'admin'
  )
);

create policy announcements_admin_del
on public.announcements
for delete
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role_slug = 'admin'
  )
);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_announcements_set_updated_at on public.announcements;
create trigger trg_announcements_set_updated_at
before update on public.announcements
for each row
execute function public.set_updated_at();

