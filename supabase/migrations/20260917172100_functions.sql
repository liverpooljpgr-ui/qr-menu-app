-- Access helpers (private schema, not reachable via the Data API) and the public RPCs
-- that form the entire guest/anonymous write surface.
--
-- All security definer functions pin search_path = '' and schema-qualify every reference,
-- per Supabase guidance, so callers can't hijack unqualified names.

-- ---------------------------------------------------------------------------
-- Private access helpers used by RLS policies
-- ---------------------------------------------------------------------------

create or replace function private.user_is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.user_org_role(org_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.memberships m
  where m.organization_id = org_id
    and m.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function private.user_has_venue_access(v_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.venues v
    join public.memberships m on m.organization_id = v.organization_id
    where v.id = v_id
      and m.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Org bootstrap: no membership exists yet to satisfy an insert policy, so org
-- creation goes through here and creates the owner membership atomically.
-- ---------------------------------------------------------------------------

create or replace function public.create_organization(p_name text, p_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org public.organizations;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  insert into public.organizations (name, slug)
  values (p_name, p_slug)
  returning * into v_org;

  insert into public.memberships (organization_id, user_id, role)
  values (v_org.id, v_uid, 'owner');

  return v_org;
end;
$$;

-- ---------------------------------------------------------------------------
-- Publishing: serialize the editing tree into an immutable snapshot.
-- ---------------------------------------------------------------------------

create or replace function public.publish_menu(p_menu_id uuid)
returns public.menu_publications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_menu public.menus;
  v_venue public.venues;
  v_snapshot jsonb;
  v_version integer;
  v_pub public.menu_publications;
begin
  select * into v_menu from public.menus where id = p_menu_id;
  if v_menu.id is null or not private.user_has_venue_access(v_menu.venue_id) then
    raise exception 'menu not found or access denied' using errcode = '42501';
  end if;

  -- Verification gates publishing, not initial setup.
  if not exists (
    select 1 from auth.users u where u.id = v_uid and u.email_confirmed_at is not null
  ) then
    raise exception 'email verification required to publish' using errcode = '42501';
  end if;

  select * into v_venue from public.venues where id = v_menu.venue_id;

  select jsonb_build_object(
    'venue', jsonb_build_object(
      'id', v_venue.id,
      'name', v_venue.name,
      'slug', v_venue.slug,
      'currency', v_venue.currency,
      'default_locale', v_venue.default_locale,
      'supported_locales', to_jsonb(v_venue.supported_locales)
    ),
    'menu', jsonb_build_object(
      'id', v_menu.id,
      'name', v_menu.name,
      'translations', v_menu.translations
    ),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'translations', s.translations,
        'position', s.position,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id,
            'name', i.name,
            'description', i.description,
            'translations', i.translations,
            'price_minor', i.price_minor,
            'photo_path', i.photo_path,
            'is_available', i.is_available,
            'tags', to_jsonb(i.tags),
            'position', i.position,
            'option_groups', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', g.id,
                'name', g.name,
                'translations', g.translations,
                'selection_type', g.selection_type,
                'position', g.position,
                'choices', coalesce((
                  select jsonb_agg(jsonb_build_object(
                    'id', c.id,
                    'name', c.name,
                    'translations', c.translations,
                    'price_delta_minor', c.price_delta_minor,
                    'position', c.position
                  ) order by c.position, c.created_at)
                  from public.option_choices c
                  where c.option_group_id = g.id
                ), '[]'::jsonb)
              ) order by g.position, g.created_at)
              from public.option_groups g
              where g.menu_item_id = i.id
            ), '[]'::jsonb)
          ) order by i.position, i.created_at)
          from public.menu_items i
          where i.section_id = s.id
        ), '[]'::jsonb)
      ) order by s.position, s.created_at)
      from public.menu_sections s
      where s.menu_id = v_menu.id
    ), '[]'::jsonb)
  ) into v_snapshot;

  select coalesce(max(version), 0) + 1 into v_version
  from public.menu_publications
  where menu_id = p_menu_id;

  update public.menu_publications
  set is_current = false
  where menu_id = p_menu_id and is_current;

  insert into public.menu_publications (menu_id, venue_id, version, snapshot, is_current, published_by)
  values (p_menu_id, v_menu.venue_id, v_version, v_snapshot, true, v_uid)
  returning * into v_pub;

  update public.menus
  set status = 'published', published_at = v_pub.published_at
  where id = p_menu_id;

  return v_pub;
end;
$$;

create or replace function public.unpublish_menu(p_menu_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
begin
  select venue_id into v_venue_id from public.menus where id = p_menu_id;
  if v_venue_id is null or not private.user_has_venue_access(v_venue_id) then
    raise exception 'menu not found or access denied' using errcode = '42501';
  end if;

  update public.menu_publications
  set is_current = false
  where menu_id = p_menu_id and is_current;

  update public.menus
  set status = 'draft'
  where id = p_menu_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guest entry points. Each returns only what a single scan/visit needs, so
-- venue/table/branding rows never need to be publicly readable.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_qr_token(p_token text)
returns table (
  venue_id uuid,
  venue_name text,
  venue_slug text,
  currency text,
  default_locale text,
  supported_locales text[],
  table_id uuid,
  table_label text,
  branding jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.id,
    v.name,
    v.slug,
    v.currency,
    v.default_locale,
    v.supported_locales,
    t.id,
    t.label,
    jsonb_build_object('theme_key', b.theme_key, 'palette', b.palette, 'logo_path', b.logo_path)
  from public.tables t
  join public.venues v on v.id = t.venue_id
  left join public.brandings b on b.venue_id = v.id
  where t.qr_token = p_token
    and t.is_active;
$$;

create or replace function public.resolve_venue_slug(p_slug text)
returns table (
  venue_id uuid,
  venue_name text,
  venue_slug text,
  currency text,
  default_locale text,
  supported_locales text[],
  branding jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.id,
    v.name,
    v.slug,
    v.currency,
    v.default_locale,
    v.supported_locales,
    jsonb_build_object('theme_key', b.theme_key, 'palette', b.palette, 'logo_path', b.logo_path)
  from public.venues v
  left join public.brandings b on b.venue_id = v.id
  where v.slug = p_slug
    and exists (
      select 1 from public.menu_publications p
      where p.venue_id = v.id and p.is_current
    );
$$;

create or replace function public.start_guest_session(
  p_token text default null,
  p_venue_slug text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
  v_table_id uuid;
  v_session_id uuid;
begin
  if p_token is not null then
    select t.venue_id, t.id into v_venue_id, v_table_id
    from public.tables t
    where t.qr_token = p_token and t.is_active;
  elsif p_venue_slug is not null then
    select v.id into v_venue_id
    from public.venues v
    where v.slug = p_venue_slug
      and exists (
        select 1 from public.menu_publications p
        where p.venue_id = v.id and p.is_current
      );
  end if;

  if v_venue_id is null then
    raise exception 'invalid or inactive entry point' using errcode = 'P0002';
  end if;

  insert into public.guest_sessions (venue_id, table_id, user_agent)
  values (v_venue_id, v_table_id, left(p_user_agent, 512))
  returning id into v_session_id;

  return v_session_id;
end;
$$;

create or replace function public.log_event(
  p_session_id uuid,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
begin
  select venue_id into v_venue_id from public.guest_sessions where id = p_session_id;
  if v_venue_id is null then
    raise exception 'unknown guest session' using errcode = 'P0002';
  end if;

  if p_event_type is null or length(p_event_type) = 0 or length(p_event_type) > 64 then
    raise exception 'invalid event_type' using errcode = '22023';
  end if;

  insert into public.events (guest_session_id, venue_id, event_type, payload)
  values (p_session_id, v_venue_id, p_event_type, coalesce(p_payload, '{}'::jsonb));

  update public.guest_sessions set last_seen_at = now() where id = p_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute grants: member-only RPCs are not callable anonymously.
-- ---------------------------------------------------------------------------

revoke execute on function public.create_organization(text, text) from public, anon;
revoke execute on function public.publish_menu(uuid) from public, anon;
revoke execute on function public.unpublish_menu(uuid) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.publish_menu(uuid) to authenticated;
grant execute on function public.unpublish_menu(uuid) to authenticated;

grant execute on function public.resolve_qr_token(text) to anon, authenticated;
grant execute on function public.resolve_venue_slug(text) to anon, authenticated;
grant execute on function public.start_guest_session(text, text, text) to anon, authenticated;
grant execute on function public.log_event(uuid, text, jsonb) to anon, authenticated;
