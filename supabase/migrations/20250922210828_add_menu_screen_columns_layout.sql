-- Add column layout support for menu screens

-- number of columns for a screen
alter table public.menu_screens
add column if not exists num_columns integer not null default 3 check (num_columns between 1 and 4);

comment on column public.menu_screens.num_columns is 'How many columns to render in public menu (1-4)';

-- per-category column placement
alter table public.menu_screen_categories
add column if not exists column_index integer not null default 0 check (column_index >= 0);

comment on column public.menu_screen_categories.column_index is 'Zero-based column index for where to place this category';


