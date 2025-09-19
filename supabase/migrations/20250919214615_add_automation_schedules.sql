-- Create automation_schedules table
create table if not exists public.automation_schedules (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  job_type text not null check (job_type in ('shift_reminder', 'low_stock_notification')),
  schedule_type text not null check (schedule_type in ('daily', 'weekly', 'monthly')),
  schedule_config jsonb not null, -- { time: "09:00", days: [1,2,3,4,5], frequency: "daily" }
  is_enabled boolean default true,
  qstash_job_id text, -- Store QStash job ID for management
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references public.profiles(id) on delete cascade
);

-- Create automation_logs table for tracking job executions
create table if not exists public.automation_logs (
  id uuid default gen_random_uuid() primary key,
  schedule_id uuid references public.automation_schedules(id) on delete cascade,
  job_type text not null,
  status text not null check (status in ('success', 'failed', 'running')),
  message text,
  details jsonb,
  executed_at timestamptz default now(),
  duration_ms integer
);

-- RLS Policies
alter table public.automation_schedules enable row level security;
alter table public.automation_logs enable row level security;

-- Automation schedules: admins can manage all, others can read
create policy automation_schedules_admin_all on public.automation_schedules
  for all using (
    exists (
      select 1 from public.profiles 
      where profiles.id = auth.uid() 
      and profiles.role_slug = 'admin'
    )
  );

-- Automation logs: admins can manage all, others can read
create policy automation_logs_admin_all on public.automation_logs
  for all using (
    exists (
      select 1 from public.profiles 
      where profiles.id = auth.uid() 
      and profiles.role_slug = 'admin'
    )
  );

-- Functions for automation
create or replace function public.update_automation_schedule_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger automation_schedules_updated_at
  before update on public.automation_schedules
  for each row execute function public.update_automation_schedule_updated_at();

-- Function to calculate next run time
create or replace function public.calculate_next_run_time(
  schedule_type text,
  schedule_config jsonb,
  current_ts timestamptz default now()
) returns timestamptz as $$
declare
  next_run timestamptz;
  target_time text;
  target_days integer[];
  current_day integer;
  days_until_next integer;
begin
  target_time := schedule_config->>'time';
  target_days := array(select jsonb_array_elements_text(schedule_config->'days')::integer);
  current_day := extract(dow from current_ts)::integer;
  
  if schedule_type = 'daily' then
    -- Daily: next occurrence at target time
    next_run := date_trunc('day', current_ts) + (target_time || ' hours')::interval;
    if next_run <= current_ts then
      next_run := next_run + interval '1 day';
    end if;
  elsif schedule_type = 'weekly' then
    -- Weekly: next occurrence on target day at target time
    next_run := date_trunc('day', current_ts) + (target_time || ' hours')::interval;
    
    -- Find next target day
    days_until_next := (
      select min(
        case 
          when day >= current_day then day - current_day
          else 7 - current_day + day
        end
      )
      from unnest(target_days) as day
    );
    
    next_run := next_run + (days_until_next || ' days')::interval;
  end if;
  
  return next_run;
end;
$$ language plpgsql;

-- Insert default automation schedules
insert into public.automation_schedules (name, description, job_type, schedule_type, schedule_config, created_by)
select 
  'Daily Shift Reminders',
  'Send email reminders to staff about their upcoming shifts',
  'shift_reminder',
  'daily',
  '{"time": "09:00", "days": [1,2,3,4,5,6,7]}'::jsonb,
  profiles.id
from public.profiles 
where profiles.role_slug = 'admin'
limit 1;

insert into public.automation_schedules (name, description, job_type, schedule_type, schedule_config, created_by)
select 
  'Low Stock Notifications',
  'Send notifications when products are running low on stock',
  'low_stock_notification',
  'daily',
  '{"time": "08:00", "days": [1,2,3,4,5]}'::jsonb,
  profiles.id
from public.profiles 
where profiles.role_slug = 'admin'
limit 1;
