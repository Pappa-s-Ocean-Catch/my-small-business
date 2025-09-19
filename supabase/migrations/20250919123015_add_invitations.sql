-- Invitations and staff/profile linking
-- NOTE: Use profiles.id = auth.uid() throughout per rules

create extension if not exists pgcrypto;

-- Invitations table
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role_slug text not null default 'staff',
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

alter table public.invitations enable row level security;

-- Policies: only admins can manage invitations
drop policy if exists invitations_select_admin on public.invitations;
create policy invitations_select_admin on public.invitations
for select using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role_slug = 'admin'
  )
);

drop policy if exists invitations_modify_admin on public.invitations;
create policy invitations_modify_admin on public.invitations
for all using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role_slug = 'admin'
  )
) with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role_slug = 'admin'
  )
);

-- Link staff to profiles for permission checks
do $$ begin
  alter table public.staff add column if not exists profile_id uuid references public.profiles(id) on delete set null;
exception when duplicate_column then null; end $$;

create index if not exists idx_staff_profile_id on public.staff(profile_id);

-- Helper function to link staff.profile_id by email after user signs in
create or replace function public.link_staff_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.staff s
  set profile_id = p_profile_id
  from public.profiles p
  where p.id = p_profile_id
    and s.email is not null
    and lower(s.email) = lower(p.email)
    and (s.profile_id is distinct from p_profile_id);
end;
$$;

revoke all on function public.link_staff_profile(uuid) from public;


