-- Fix recursive RLS policy on profiles by removing self-referencing EXISTS

drop policy if exists profiles_self_read on public.profiles;

create policy profiles_self_read
on public.profiles
for select
using (
  auth.uid() = id
);


