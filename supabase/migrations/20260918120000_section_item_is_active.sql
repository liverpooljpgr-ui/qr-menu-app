-- Sections and items can be deactivated by members. Inactive rows stay editable
-- but are excluded from publish snapshots, so they never reach guests.
-- Distinct from menu_items.is_available, which marks a visible item as sold out.

alter table public.menu_sections
  add column is_active boolean not null default true;

alter table public.menu_items
  add column is_active boolean not null default true;

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
            and i.is_active
        ), '[]'::jsonb)
      ) order by s.position, s.created_at)
      from public.menu_sections s
      where s.menu_id = v_menu.id
        and s.is_active
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
