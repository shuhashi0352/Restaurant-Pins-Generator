create table if not exists public.map_members (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (map_id, user_id)
);

create index if not exists map_members_map_id_idx on public.map_members(map_id);
create index if not exists map_members_user_id_idx on public.map_members(user_id);

insert into public.map_members (map_id, user_id, role)
select id, owner_id, 'owner'
from public.maps
on conflict (map_id, user_id) do update set role = 'owner';

create or replace function public.handle_new_map_owner_member()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.map_members (map_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (map_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

drop trigger if exists on_map_created_owner_member on public.maps;
create trigger on_map_created_owner_member
after insert on public.maps
for each row execute function public.handle_new_map_owner_member();

create or replace function public.current_user_map_role(target_map_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.map_members
  where map_id = target_map_id
    and user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_user_can_edit_map(target_map_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_map_role(target_map_id) in ('owner', 'editor'), false)
$$;

alter table public.map_members enable row level security;

drop policy if exists "Users can select own memberships" on public.map_members;
create policy "Users can select own memberships"
on public.map_members for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Owners can select map memberships" on public.map_members;
create policy "Owners can select map memberships"
on public.map_members for select
to authenticated
using (
  exists (
    select 1 from public.maps
    where maps.id = map_members.map_id
      and maps.owner_id = auth.uid()
  )
);

drop policy if exists "Users can join editable shared maps" on public.map_members;
create policy "Users can join editable shared maps"
on public.map_members for insert
to authenticated
with check (
  auth.uid() = user_id
  and role = 'editor'
  and exists (
    select 1 from public.maps
    where maps.id = map_members.map_id
      and maps.share_enabled = true
      and maps.share_permission = 'edit'
      and maps.share_token is not null
  )
);

drop policy if exists "Owners can manage memberships" on public.map_members;
create policy "Owners can manage memberships"
on public.map_members for all
to authenticated
using (
  exists (
    select 1 from public.maps
    where maps.id = map_members.map_id
      and maps.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.maps
    where maps.id = map_members.map_id
      and maps.owner_id = auth.uid()
  )
);

drop policy if exists "Users can select member maps" on public.maps;
create policy "Users can select member maps"
on public.maps for select
to authenticated
using (public.current_user_map_role(id) in ('owner', 'editor', 'viewer'));

drop policy if exists "Members can select pins for maps" on public.pins;
create policy "Members can select pins for maps"
on public.pins for select
to authenticated
using (public.current_user_map_role(map_id) in ('owner', 'editor', 'viewer'));

comment on table public.map_members is
'Collaborative memberships for canonical shared maps. Editable links add editor members instead of duplicating maps.';
