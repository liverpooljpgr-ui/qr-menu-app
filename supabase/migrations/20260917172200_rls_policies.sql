-- Row Level Security. Core rule: a user may read/write a row only if they hold a membership
-- in the organization that owns the row's venue. Guests (anon) can read current menu
-- publications and nothing else; all anonymous writes go through the RPCs in the previous
-- migration. Every policy names its role explicitly so anon never evaluates member checks.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere (a table with policies but RLS off allows everything)
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.venues enable row level security;
alter table public.brandings enable row level security;
alter table public.menus enable row level security;
alter table public.menu_sections enable row level security;
alter table public.menu_items enable row level security;
alter table public.option_groups enable row level security;
alter table public.option_choices enable row level security;
alter table public.tables enable row level security;
alter table public.guest_sessions enable row level security;
alter table public.events enable row level security;
alter table public.menu_publications enable row level security;

-- ---------------------------------------------------------------------------
-- Privileges. Supabase's default grants give anon full table access (RLS then
-- filters); tighten so the anonymous surface is exactly: select on current
-- publications + the guest RPCs.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
grant select on public.menu_publications to anon;

-- Policies and triggers run as the querying role, so authenticated needs to
-- execute the private helpers. anon never does (no anon policy calls one).
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema private grant execute on functions to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- organizations — no insert policy: creation goes through create_organization()
-- ---------------------------------------------------------------------------

create policy "members can view their organizations"
  on public.organizations for select to authenticated
  using (private.user_is_org_member(id));

create policy "members can update their organizations"
  on public.organizations for update to authenticated
  using (private.user_is_org_member(id))
  with check (private.user_is_org_member(id));

create policy "owners can delete their organizations"
  on public.organizations for delete to authenticated
  using (private.user_org_role(id) = 'owner');

-- ---------------------------------------------------------------------------
-- memberships — owners manage everyone; managers manage non-owners only,
-- which also stops a manager from promoting themselves to owner.
-- ---------------------------------------------------------------------------

create policy "members can view memberships in their organizations"
  on public.memberships for select to authenticated
  using (private.user_is_org_member(organization_id));

create policy "owners and managers can add memberships"
  on public.memberships for insert to authenticated
  with check (
    private.user_org_role(organization_id) = 'owner'
    or (private.user_org_role(organization_id) = 'manager' and role <> 'owner')
  );

create policy "owners and managers can update memberships"
  on public.memberships for update to authenticated
  using (
    private.user_org_role(organization_id) = 'owner'
    or (private.user_org_role(organization_id) = 'manager' and role <> 'owner')
  )
  with check (
    private.user_org_role(organization_id) = 'owner'
    or (private.user_org_role(organization_id) = 'manager' and role <> 'owner')
  );

create policy "owners and managers can remove memberships"
  on public.memberships for delete to authenticated
  using (
    private.user_org_role(organization_id) = 'owner'
    or (private.user_org_role(organization_id) = 'manager' and role <> 'owner')
  );

-- ---------------------------------------------------------------------------
-- venues — with check on update uses the NEW organization_id, so a venue can't
-- be moved into an organization the user doesn't belong to.
-- ---------------------------------------------------------------------------

create policy "members can view venues"
  on public.venues for select to authenticated
  using (private.user_has_venue_access(id));

create policy "members can create venues in their organizations"
  on public.venues for insert to authenticated
  with check (private.user_is_org_member(organization_id));

create policy "members can update venues"
  on public.venues for update to authenticated
  using (private.user_has_venue_access(id))
  with check (private.user_is_org_member(organization_id));

create policy "owners can delete venues"
  on public.venues for delete to authenticated
  using (private.user_org_role(organization_id) = 'owner');

-- ---------------------------------------------------------------------------
-- Venue-scoped content: one membership check on the row's own venue_id.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'brandings', 'menus', 'menu_sections', 'menu_items',
    'option_groups', 'option_choices', 'tables'
  ]
  loop
    execute format(
      'create policy "members can manage %1$s" on public.%1$I for all to authenticated
         using (private.user_has_venue_access(venue_id))
         with check (private.user_has_venue_access(venue_id))',
      t
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- menu_publications — the public-read exception. Written only by publish_menu().
-- ---------------------------------------------------------------------------

create policy "anyone can read current publications"
  on public.menu_publications for select to anon
  using (is_current);

create policy "members can read all publications for their venues"
  on public.menu_publications for select to authenticated
  using (is_current or private.user_has_venue_access(venue_id));

-- ---------------------------------------------------------------------------
-- Guest analytics — members read their venues' data; no direct writes for anyone.
-- ---------------------------------------------------------------------------

create policy "members can view guest sessions"
  on public.guest_sessions for select to authenticated
  using (private.user_has_venue_access(venue_id));

create policy "members can view events"
  on public.events for select to authenticated
  using (private.user_has_venue_access(venue_id));
