-- Add subtitle to menu_screens for configurable tagline

alter table public.menu_screens
add column if not exists subtitle text;

comment on column public.menu_screens.subtitle is 'Optional subtitle/tagline for the public screen header';
