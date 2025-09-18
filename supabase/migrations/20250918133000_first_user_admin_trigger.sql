-- Create a trigger to insert into public.profiles when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Determine role: if no admins exist yet, make this user admin; otherwise staff
  insert into public.profiles (id, email, role_slug)
  values (
    new.id,
    new.email,
    case when exists (select 1 from public.profiles where role_slug = 'admin') then 'staff' else 'admin' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


