alter table public.orders add column if not exists scheduled_delivery_at timestamptz;
comment on column public.orders.scheduled_delivery_at is 'Requested delivery arrival time; scheduled_pickup_at is the restaurant pickup/food-ready time.';
