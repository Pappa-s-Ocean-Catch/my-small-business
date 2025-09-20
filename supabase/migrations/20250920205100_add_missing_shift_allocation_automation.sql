-- Add missing_shift_allocation job type to automation_schedules
alter table public.automation_schedules 
drop constraint if exists automation_schedules_job_type_check;

alter table public.automation_schedules 
add constraint automation_schedules_job_type_check 
check (job_type in ('shift_reminder', 'low_stock_notification', 'missing_shift_allocation'));

-- Add custom_config field to support additional configuration options
alter table public.automation_schedules 
add column if not exists custom_config jsonb default '{}';

-- Update the constraint to allow more flexible schedule_config
-- The schedule_config will now support:
-- - time: execution time
-- - days: days of week for weekly schedules
-- - frequency: for monthly schedules
-- - custom fields: recipient_emails, days_to_check, etc.

-- Add comment to clarify the new structure
comment on column public.automation_schedules.schedule_config is 'Basic scheduling configuration: time, days, frequency';
comment on column public.automation_schedules.custom_config is 'Job-specific configuration: recipient_emails, days_to_check, thresholds, etc.';

-- Insert default missing shift allocation schedule
insert into public.automation_schedules (name, description, job_type, schedule_type, schedule_config, custom_config, created_by)
select 
  'Missing Shift Allocation Check',
  'Check for missing shift allocations in the next 7 days and notify admins',
  'missing_shift_allocation',
  'daily',
  '{"time": "10:00", "days": [1,2,3,4,5]}'::jsonb,
  '{"recipient_emails": [], "days_to_check": 7, "check_all_days": true}'::jsonb,
  profiles.id
from public.profiles 
where profiles.role_slug = 'admin'
limit 1;
