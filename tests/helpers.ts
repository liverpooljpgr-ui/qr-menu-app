import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

export type Db = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
export const secretKey = process.env.SUPABASE_SECRET_KEY;

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

// Bypasses RLS. Only for provisioning users and verifying/cleaning fixture state.
export function adminClient(): Db {
  return createClient<Database>(url, secretKey!, clientOptions);
}

export function anonClient(): Db {
  return createClient<Database>(url, publishableKey, clientOptions);
}

export function unwrap<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null || result.data === undefined) {
    throw new Error("expected data, got null");
  }
  return result.data;
}

export interface TestUser {
  id: string;
  email: string;
  client: Db;
}

export async function createTestUser(admin: Db, label: string, runId: string): Promise<TestUser> {
  const email = `rls-${label}-${runId}@example.com`;
  const password = `Test-${runId}-${label}!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;

  const client = createClient<Database>(url, publishableKey, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { id: data.user.id, email, client };
}

export interface OrgFixture {
  owner: TestUser;
  orgId: string;
  venueId: string;
  brandingId: string;
  menuId: string;
  sectionId: string;
  itemId: string;
  groupId: string;
  choiceId: string;
  tableId: string;
  qrToken: string;
  currentPublicationId: string;
  oldPublicationId: string;
  guestSessionId: string;
  eventId: string;
}

// Builds a full tenant through the owner's own client, so it doubles as the
// positive-path check that members can write their own data.
export async function buildOrgFixture(
  owner: TestUser,
  admin: Db,
  label: string,
  runId: string
): Promise<OrgFixture> {
  const c = owner.client;
  const slug = `rls-${label}-${runId}`;

  const org = unwrap(await c.rpc("create_organization", { p_name: `Org ${label}`, p_slug: slug }));

  const venue = unwrap(
    await c
      .from("venues")
      .insert({ organization_id: org.id, name: `Venue ${label}`, slug, currency: "USD" })
      .select()
      .single()
  );

  const branding = unwrap(
    await c.from("brandings").insert({ venue_id: venue.id, theme_key: "minimal" }).select().single()
  );

  const menu = unwrap(
    await c.from("menus").insert({ venue_id: venue.id, name: `Menu ${label}` }).select().single()
  );

  const section = unwrap(
    await c
      .from("menu_sections")
      .insert({ menu_id: menu.id, venue_id: venue.id, name: "Starters" })
      .select()
      .single()
  );

  const item = unwrap(
    await c
      .from("menu_items")
      .insert({ section_id: section.id, venue_id: venue.id, name: "Soup", price_minor: 650 })
      .select()
      .single()
  );

  const group = unwrap(
    await c
      .from("option_groups")
      .insert({ menu_item_id: item.id, venue_id: venue.id, name: "Size" })
      .select()
      .single()
  );

  const choice = unwrap(
    await c
      .from("option_choices")
      .insert({ option_group_id: group.id, venue_id: venue.id, name: "Large", price_delta_minor: 200 })
      .select()
      .single()
  );

  const table = unwrap(
    await c.from("tables").insert({ venue_id: venue.id, label: "Table 1" }).select().single()
  );

  // Publish twice so a non-current version exists.
  const oldPublication = unwrap(await c.rpc("publish_menu", { p_menu_id: menu.id }));
  const currentPublication = unwrap(await c.rpc("publish_menu", { p_menu_id: menu.id }));

  const anon = anonClient();
  const guestSessionId = unwrap(
    await anon.rpc("start_guest_session", { p_token: table.qr_token, p_user_agent: "vitest" })
  );
  const logged = await anon.rpc("log_event", {
    p_session_id: guestSessionId,
    p_event_type: "menu_view",
  });
  if (logged.error) throw new Error(logged.error.message);

  const event = unwrap(
    await admin.from("events").select("id").eq("guest_session_id", guestSessionId).single()
  );

  return {
    owner,
    orgId: org.id,
    venueId: venue.id,
    brandingId: branding.id,
    menuId: menu.id,
    sectionId: section.id,
    itemId: item.id,
    groupId: group.id,
    choiceId: choice.id,
    tableId: table.id,
    qrToken: table.qr_token,
    currentPublicationId: currentPublication.id,
    oldPublicationId: oldPublication.id,
    guestSessionId,
    eventId: event.id,
  };
}

// Deletes by run-id slug pattern rather than collected ids, so a fixture that
// failed halfway through still gets removed.
export async function cleanup(admin: Db, runId: string, userIds: string[]) {
  await admin.from("organizations").delete().like("slug", `rls-%-${runId}`);
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id);
  }
}
