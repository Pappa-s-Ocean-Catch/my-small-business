-- Add show_images flag to menu_screens to control product image display

alter table public.menu_screens
add column if not exists show_images boolean not null default false;

comment on column public.menu_screens.show_images is 'Whether public menu should display product images';


