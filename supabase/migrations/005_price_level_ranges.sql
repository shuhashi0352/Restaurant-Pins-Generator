alter table public.maps drop constraint if exists maps_price_level_check;

alter table public.maps
add constraint maps_price_level_check
check (price_level in ('any', '1', '2', '3', '4', '1-1', '1-2', '1-3', '1-4', '2-2', '2-3', '2-4', '3-3', '3-4', '4-4'));
