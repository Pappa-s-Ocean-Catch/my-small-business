-- Fix RLS policies for automation schedules to allow service role access
-- This allows QStash webhooks to access automation schedules without authentication

-- Drop existing policy
drop policy if exists automation_schedules_admin_all on public.automation_schedules;

-- Create new policy that allows both admin users and service role
create policy automation_schedules_access on public.automation_schedules
  for all using (
    -- Allow admin users
    exists (
      select 1 from public.profiles 
      where profiles.id = auth.uid() 
      and profiles.role_slug = 'admin'
    )
    -- Allow service role (for QStash webhooks)
    or auth.role() = 'service_role'
  );

-- Also fix automation_logs policy
drop policy if exists automation_logs_admin_all on public.automation_logs;

create policy automation_logs_access on public.automation_logs
  for all using (
    -- Allow admin users
    exists (
      select 1 from public.profiles 
      where profiles.id = auth.uid() 
      and profiles.role_slug = 'admin'
    )
    -- Allow service role (for QStash webhooks)
    or auth.role() = 'service_role'
  );
