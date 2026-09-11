-- Create tv_menus table
create table public.tv_menus (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  url text not null,
  is_active boolean default true not null,
  sort_order int default 0 not null,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.tv_menus enable row level security;

-- Policies
create policy "Allow public read access on tv_menus"
  on public.tv_menus
  for select
  to public
  using (true);

create policy "Allow authenticated insert on tv_menus"
  on public.tv_menus
  for insert
  to authenticated
  with check (true);

create policy "Allow authenticated update on tv_menus"
  on public.tv_menus
  for update
  to authenticated
  using (true);

create policy "Allow authenticated delete on tv_menus"
  on public.tv_menus
  for delete
  to authenticated
  using (true);

-- Create storage bucket for TV menus
insert into storage.buckets (id, name, public)
values ('tv_menus', 'tv_menus', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Allow public read access on tv_menus bucket"
  on storage.objects
  for select
  to public
  using (bucket_id = 'tv_menus');

create policy "Allow authenticated uploads to tv_menus bucket"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'tv_menus');

create policy "Allow authenticated updates on tv_menus bucket"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'tv_menus');

create policy "Allow authenticated deletes on tv_menus bucket"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'tv_menus');
