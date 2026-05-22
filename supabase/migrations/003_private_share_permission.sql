alter table public.maps
alter column share_permission set default 'private';

alter table public.maps
drop constraint if exists maps_share_permission_check;

alter table public.maps
add constraint maps_share_permission_check check (share_permission in ('private', 'view', 'edit'));

update public.maps
set share_permission = 'private'
where share_enabled = false
  and share_permission <> 'private';

comment on column public.maps.share_permission is
'Access mode for share links: private disables token access, view allows read-only token access, edit allows token-scoped collaborative edits through server API routes.';
