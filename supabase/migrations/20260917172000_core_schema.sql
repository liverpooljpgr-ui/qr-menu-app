-- Core schema: organizations → venues → menus → sections → items → option groups → choices,
-- plus tables (QR entry points), anonymous guest analytics, and immutable menu publications.
--
-- Every venue-scoped table carries venue_id directly, enforced by composite FKs so it can't
-- drift from its parent. This keeps every RLS check a single indexed function call.

create extension if not exists pgcrypto with schema extensions;

-- Helpers that must exist before tables reference them. Not exposed by the Data API.
create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 12 random bytes → 16 url-safe chars. Short enough for a clean, scannable QR.
create or replace function private.generate_qr_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=', '-_');
$$;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'UTC',
  default_locale text not null default 'en',
  supported_locales text[] not null default '{en}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index venues_organization_id_idx on public.venues (organization_id);

create table public.brandings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null unique references public.venues (id) on delete cascade,
  theme_key text,
  palette jsonb not null default '{}'::jsonb,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Menu content (the editing model — guests never read these tables directly)
-- ---------------------------------------------------------------------------

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null default 'Menu',
  translations jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id)
);
create index menus_venue_id_idx on public.menus (venue_id);

create table public.menu_sections (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null,
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  translations jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (menu_id, venue_id) references public.menus (id, venue_id) on delete cascade,
  unique (id, venue_id)
);
create index menu_sections_menu_id_position_idx on public.menu_sections (menu_id, position);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null,
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  description text,
  translations jsonb not null default '{}'::jsonb,
  price_minor integer not null check (price_minor >= 0),
  photo_path text,
  is_available boolean not null default true,
  tags text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (section_id, venue_id) references public.menu_sections (id, venue_id) on delete cascade,
  unique (id, venue_id)
);
create index menu_items_section_id_position_idx on public.menu_items (section_id, position);

create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null,
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  translations jsonb not null default '{}'::jsonb,
  selection_type text not null default 'single' check (selection_type in ('single', 'multiple')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (menu_item_id, venue_id) references public.menu_items (id, venue_id) on delete cascade,
  unique (id, venue_id)
);
create index option_groups_menu_item_id_position_idx on public.option_groups (menu_item_id, position);

create table public.option_choices (
  id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null,
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  translations jsonb not null default '{}'::jsonb,
  price_delta_minor integer not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (option_group_id, venue_id) references public.option_groups (id, venue_id) on delete cascade
);
create index option_choices_option_group_id_position_idx on public.option_choices (option_group_id, position);

-- ---------------------------------------------------------------------------
-- Physical tables / QR entry points
-- ---------------------------------------------------------------------------

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  label text not null,
  qr_token text not null unique default private.generate_qr_token(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, label)
);
create index tables_venue_id_idx on public.tables (venue_id);

-- ---------------------------------------------------------------------------
-- Anonymous guest analytics (append-only, written only via RPC)
-- ---------------------------------------------------------------------------

create table public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  table_id uuid references public.tables (id) on delete set null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent text
);
create index guest_sessions_venue_id_started_at_idx on public.guest_sessions (venue_id, started_at desc);
create index guest_sessions_table_id_idx on public.guest_sessions (table_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  guest_session_id uuid references public.guest_sessions (id) on delete set null,
  venue_id uuid not null references public.venues (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb check (octet_length(payload::text) <= 4096),
  created_at timestamptz not null default now()
);
create index events_venue_id_created_at_idx on public.events (venue_id, created_at desc);
create index events_guest_session_id_idx on public.events (guest_session_id);

-- ---------------------------------------------------------------------------
-- Immutable published snapshots — the only menu data guests ever read
-- ---------------------------------------------------------------------------

create table public.menu_publications (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  is_current boolean not null default false,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null,
  unique (menu_id, version)
);
create unique index menu_publications_current_idx on public.menu_publications (menu_id) where is_current;
create index menu_publications_venue_current_idx on public.menu_publications (venue_id) where is_current;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'memberships', 'venues', 'brandings', 'menus',
    'menu_sections', 'menu_items', 'option_groups', 'option_choices', 'tables'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      t
    );
  end loop;
end
$$;
