-- venues' select/update policies looked the venue up by its own id via
-- user_has_venue_access(id). On INSERT ... RETURNING the SELECT policy is also
-- evaluated, but the new row isn't visible to a lookup within the same statement,
-- so every returning insert failed RLS. Check the row's own organization_id instead.

drop policy "members can view venues" on public.venues;
drop policy "members can update venues" on public.venues;

create policy "members can view venues"
  on public.venues for select to authenticated
  using (private.user_is_org_member(organization_id));

create policy "members can update venues"
  on public.venues for update to authenticated
  using (private.user_is_org_member(organization_id))
  with check (private.user_is_org_member(organization_id));
