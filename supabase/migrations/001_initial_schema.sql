create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.maps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  center_label text not null,
  radius_meters integer not null check (radius_meters between 100 and 50000),
  min_rating numeric check (min_rating is null or (min_rating >= 0 and min_rating <= 5)),
  min_review_count integer check (min_review_count is null or min_review_count >= 0),
  max_pins integer not null check (max_pins between 1 and 60),
  icon text not null check (icon in ('restaurant', 'star', 'heart', 'flag', 'pin')),
  price_level text not null default 'any' check (price_level in ('any', '1', '2', '3', '4')),
  open_now boolean,
  visibility text not null default 'private' check (visibility in ('private', 'unlisted')),
  share_enabled boolean not null default false,
  share_token text unique,
  share_permission text not null default 'private' check (share_permission in ('private', 'view', 'edit')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pins (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  google_place_id text not null,
  name text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  rating numeric,
  review_count integer,
  price_level text,
  google_maps_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists maps_owner_id_idx on public.maps(owner_id);
create index if not exists maps_share_token_idx on public.maps(share_token) where share_token is not null;
create index if not exists pins_map_id_idx on public.pins(map_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists maps_set_updated_at on public.maps;
create trigger maps_set_updated_at
before update on public.maps
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.maps enable row level security;
alter table public.pins enable row level security;

drop policy if exists "Users can select own profile" on public.profiles;
create policy "Users can select own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can select own maps" on public.maps;
create policy "Users can select own maps"
on public.maps for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "Users can insert own maps" on public.maps;
create policy "Users can insert own maps"
on public.maps for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "Users can update own maps" on public.maps;
create policy "Users can update own maps"
on public.maps for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Users can delete own maps" on public.maps;
create policy "Users can delete own maps"
on public.maps for delete
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "Public can select shared maps" on public.maps;
create policy "Public can select shared maps"
on public.maps for select
to anon, authenticated
using (share_enabled = true and share_token is not null);

drop policy if exists "Users can select pins for own maps" on public.pins;
create policy "Users can select pins for own maps"
on public.pins for select
to authenticated
using (
  exists (
    select 1 from public.maps
    where maps.id = pins.map_id
    and maps.owner_id = auth.uid()
  )
);

drop policy if exists "Users can insert pins for own maps" on public.pins;
create policy "Users can insert pins for own maps"
on public.pins for insert
to authenticated
with check (
  exists (
    select 1 from public.maps
    where maps.id = pins.map_id
    and maps.owner_id = auth.uid()
  )
);

drop policy if exists "Users can update pins for own maps" on public.pins;
create policy "Users can update pins for own maps"
on public.pins for update
to authenticated
using (
  exists (
    select 1 from public.maps
    where maps.id = pins.map_id
    and maps.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.maps
    where maps.id = pins.map_id
    and maps.owner_id = auth.uid()
  )
);

drop policy if exists "Users can delete pins for own maps" on public.pins;
create policy "Users can delete pins for own maps"
on public.pins for delete
to authenticated
using (
  exists (
    select 1 from public.maps
    where maps.id = pins.map_id
    and maps.owner_id = auth.uid()
  )
);

drop policy if exists "Public can select pins for shared maps" on public.pins;
create policy "Public can select pins for shared maps"
on public.pins for select
to anon, authenticated
using (
  exists (
    select 1 from public.maps
    where maps.id = pins.map_id
    and maps.share_enabled = true
    and maps.share_token is not null
  )
);
