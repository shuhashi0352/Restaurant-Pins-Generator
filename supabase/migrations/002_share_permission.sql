alter table public.maps
add column if not exists share_permission text not null default 'view';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'maps_share_permission_check'
      and conrelid = 'public.maps'::regclass
  ) then
    alter table public.maps
    add constraint maps_share_permission_check check (share_permission in ('view', 'edit'));
  end if;
end $$;

comment on column public.maps.share_permission is
'Controls share-link behavior. Token-scoped shared edits are enforced by server API routes with explicit permission checks.';
