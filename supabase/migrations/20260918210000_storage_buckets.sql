-- Storage rule: one bucket per asset kind, each with its own limits and
-- policies. Object names are always "{venue_id}/{filename}", and write access
-- requires membership in that venue's organization.
--
--   menu-items   item photos       (10 MB, png/jpeg/webp)
--   venue-logos  venue logos/icons (2 MB,  png/jpeg/webp/svg)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('menu-items', 'menu-items', true, 10485760,
   array['image/png', 'image/jpeg', 'image/webp']),
  ('venue-logos', 'venue-logos', true, 2097152,
   array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Member check on the object's first folder segment. The regex guard keeps a
-- malformed name from raising a cast error instead of simply being denied.
create or replace function private.storage_object_venue_access(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (storage.foldername(object_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.user_has_venue_access(((storage.foldername(object_name))[1])::uuid)
    else false
  end;
$$;

grant execute on function private.storage_object_venue_access(text) to authenticated, service_role;

-- Replace the hand-made blanket policies from initial setup.
drop policy if exists "Allow authenticated users to upload photos" on storage.objects;
drop policy if exists "Allow public read access" on storage.objects;
drop policy if exists "Allow authenticated users to update photos" on storage.objects;
drop policy if exists "Allow authenticated users to delete photos" on storage.objects;

drop policy if exists "public read of image buckets" on storage.objects;
create policy "public read of image buckets"
  on storage.objects for select to anon, authenticated
  using (bucket_id in ('menu-items', 'venue-logos'));

drop policy if exists "members write their venue folders" on storage.objects;
create policy "members write their venue folders"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('menu-items', 'venue-logos')
    and private.storage_object_venue_access(name)
  );

drop policy if exists "members update their venue folders" on storage.objects;
create policy "members update their venue folders"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('menu-items', 'venue-logos')
    and private.storage_object_venue_access(name)
  );

drop policy if exists "members delete their venue folders" on storage.objects;
create policy "members delete their venue folders"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('menu-items', 'venue-logos')
    and private.storage_object_venue_access(name)
  );
