-- Add non-billable hours to shifts
alter table public.shifts
  add column if not exists non_billable_hours numeric default 0 not null;

-- Ensure non-negative constraint
alter table public.shifts
  add constraint shifts_non_billable_hours_nonneg
  check (non_billable_hours >= 0);

