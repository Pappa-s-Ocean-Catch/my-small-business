-- Menu Screens (Public in-store menus)
-- Creates a standalone public menu screen system with drag-sorted sale categories

-- 1) Tables
create table if not exists public.menu_screens (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  theme jsonb not null default jsonb_build_object(
    'mode', 'light',
    'accentColor', '#ff6363',
    'background', '#fff8f0'
  ),
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.menu_screen_categories (
  id uuid primary key default gen_random_uuid(),
  menu_screen_id uuid not null references public.menu_screens(id) on delete cascade,
  sale_category_id uuid not null references public.sale_categories(id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  unique(menu_screen_id, sale_category_id)
);

-- 2) Helpful indexes
create index if not exists idx_menu_screens_slug on public.menu_screens(slug);
create index if not exists idx_menu_screen_categories_screen on public.menu_screen_categories(menu_screen_id, sort_order);

-- 3) RLS
alter table public.menu_screens enable row level security;
alter table public.menu_screen_categories enable row level security;

-- Public can read published menu screens and their categories
drop policy if exists menu_screens_public_read on public.menu_screens;
create policy menu_screens_public_read on public.menu_screens
  for select using (is_published = true);

drop policy if exists menu_screen_categories_public_read on public.menu_screen_categories;
create policy menu_screen_categories_public_read on public.menu_screen_categories
  for select using (
    exists (
      select 1
      from public.menu_screens ms
      where ms.id = menu_screen_id and ms.is_published = true
    )
  );

-- Admins can insert/update/delete
drop policy if exists menu_screens_admin_insert on public.menu_screens;
drop policy if exists menu_screens_admin_update on public.menu_screens;
drop policy if exists menu_screens_admin_delete on public.menu_screens;
create policy menu_screens_admin_insert on public.menu_screens
  for insert with check (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
  );
create policy menu_screens_admin_update on public.menu_screens
  for update using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
  );
create policy menu_screens_admin_delete on public.menu_screens
  for delete using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
  );

drop policy if exists menu_screen_categories_admin_insert on public.menu_screen_categories;
drop policy if exists menu_screen_categories_admin_update on public.menu_screen_categories;
drop policy if exists menu_screen_categories_admin_delete on public.menu_screen_categories;
create policy menu_screen_categories_admin_insert on public.menu_screen_categories
  for insert with check (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
  );
create policy menu_screen_categories_admin_update on public.menu_screen_categories
  for update using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
  );
create policy menu_screen_categories_admin_delete on public.menu_screen_categories
  for delete using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role_slug = 'admin')
  );

-- 4) Trigger to maintain updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_menu_screens_updated_at'
  ) then
    create trigger set_menu_screens_updated_at
    before update on public.menu_screens
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- 5) Comments
comment on table public.menu_screens is 'Standalone in-store public menu pages';
comment on column public.menu_screens.slug is 'Public slug for route /menu/[slug]';
comment on table public.menu_screen_categories is 'Selected sale categories for a menu screen with sort order';

