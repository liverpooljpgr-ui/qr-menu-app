// Standing cross-tenant isolation test. Runs against the real (linked) Supabase project
// with real authenticated sessions, so it exercises the deployed RLS policies exactly as
// the app will. Re-run on every schema change: `npm run test:isolation`.
//
// Requires SUPABASE_SECRET_KEY in .env.local to provision disposable users; skips otherwise.

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  buildOrgFixture,
  cleanup,
  createTestUser,
  secretKey,
  type Db,
  type OrgFixture,
  type TestUser,
} from "./helpers";

// Untyped view for the generic per-table matrix; fixtures are built with the typed client.
type Raw = SupabaseClient;
const raw = (c: Db) => c as unknown as Raw;

interface TableSpec {
  table: string;
  rowId: (f: OrgFixture) => string;
  patch: Record<string, unknown>;
  // A row that references the other tenant's ids — the insert must be rejected by RLS
  // (42501), not by a constraint, so `self` is available for ids that must not collide.
  foreignInsert: (other: OrgFixture, self: OrgFixture) => Record<string, unknown>;
}

const tableSpecs: TableSpec[] = [
  {
    table: "organizations",
    rowId: (f) => f.orgId,
    patch: { name: "breached" },
    foreignInsert: () => ({ name: "breached", slug: "breached-org" }),
  },
  {
    table: "memberships",
    rowId: (f) => f.owner.id, // matched on user_id, see idColumn below
    patch: { role: "staff" },
    foreignInsert: (other, self) => ({
      organization_id: other.orgId,
      user_id: self.owner.id,
      role: "owner",
    }),
  },
  {
    table: "venues",
    rowId: (f) => f.venueId,
    patch: { name: "breached" },
    foreignInsert: (f) => ({
      organization_id: f.orgId,
      name: "breached",
      slug: "breached-venue",
      currency: "USD",
    }),
  },
  {
    table: "brandings",
    rowId: (f) => f.brandingId,
    patch: { theme_key: "breached" },
    foreignInsert: (f) => ({ venue_id: f.venueId, theme_key: "breached" }),
  },
  {
    table: "menus",
    rowId: (f) => f.menuId,
    patch: { name: "breached" },
    foreignInsert: (f) => ({ venue_id: f.venueId, name: "breached" }),
  },
  {
    table: "menu_sections",
    rowId: (f) => f.sectionId,
    patch: { name: "breached" },
    foreignInsert: (f) => ({ menu_id: f.menuId, venue_id: f.venueId, name: "breached" }),
  },
  {
    table: "menu_items",
    rowId: (f) => f.itemId,
    patch: { price_minor: 1 },
    foreignInsert: (f) => ({
      section_id: f.sectionId,
      venue_id: f.venueId,
      name: "breached",
      price_minor: 1,
    }),
  },
  {
    table: "option_groups",
    rowId: (f) => f.groupId,
    patch: { name: "breached" },
    foreignInsert: (f) => ({ menu_item_id: f.itemId, venue_id: f.venueId, name: "breached" }),
  },
  {
    table: "option_choices",
    rowId: (f) => f.choiceId,
    patch: { price_delta_minor: -999 },
    foreignInsert: (f) => ({ option_group_id: f.groupId, venue_id: f.venueId, name: "breached" }),
  },
  {
    table: "tables",
    rowId: (f) => f.tableId,
    patch: { is_active: false },
    foreignInsert: (f) => ({ venue_id: f.venueId, label: "breached" }),
  },
  {
    table: "guest_sessions",
    rowId: (f) => f.guestSessionId,
    patch: { user_agent: "breached" },
    foreignInsert: (f) => ({ venue_id: f.venueId }),
  },
  {
    table: "events",
    rowId: (f) => f.eventId,
    patch: { event_type: "breached" },
    foreignInsert: (f) => ({ venue_id: f.venueId, event_type: "breached" }),
  },
];

describe.skipIf(!secretKey)("RLS tenant isolation", () => {
  const runId = Date.now().toString(36);
  let admin: Db;
  let userA: TestUser;
  let userB: TestUser;
  let userS: TestUser; // staff, later manager, in Org A
  let A: OrgFixture;
  let B: OrgFixture;
  const userIds: string[] = [];

  beforeAll(async () => {
    admin = adminClient();
    userA = await createTestUser(admin, "a", runId);
    userB = await createTestUser(admin, "b", runId);
    userS = await createTestUser(admin, "s", runId);
    userIds.push(userA.id, userB.id, userS.id);

    A = await buildOrgFixture(userA, admin, "a", runId);
    B = await buildOrgFixture(userB, admin, "b", runId);

    // Owner adds S to Org A as staff.
    const added = await userA.client
      .from("memberships")
      .insert({ organization_id: A.orgId, user_id: userS.id, role: "staff" });
    if (added.error) throw new Error(added.error.message);
  });

  afterAll(async () => {
    await cleanup(admin, runId, userIds);
  });

  describe.each(tableSpecs)("$table", (spec) => {
    const idColumn = spec.table === "memberships" ? "user_id" : "id";

    it("A cannot read B's row", async () => {
      const { data, error } = await raw(userA.client)
        .from(spec.table)
        .select("*")
        .eq(idColumn, spec.rowId(B));
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("A can read A's own row (positive control)", async () => {
      const { data, error } = await raw(userA.client)
        .from(spec.table)
        .select("*")
        .eq(idColumn, spec.rowId(A));
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("A cannot update B's row", async () => {
      const { data, error } = await raw(userA.client)
        .from(spec.table)
        .update(spec.patch)
        .eq(idColumn, spec.rowId(B))
        .select();
      expect(error).toBeNull();
      expect(data).toHaveLength(0);

      const [field, attempted] = Object.entries(spec.patch)[0];
      const { data: actual } = await raw(admin)
        .from(spec.table)
        .select(field)
        .eq(idColumn, spec.rowId(B))
        .single();
      expect((actual as unknown as Record<string, unknown>)[field]).not.toEqual(attempted);
    });

    it("A cannot delete B's row", async () => {
      const { data, error } = await raw(userA.client)
        .from(spec.table)
        .delete()
        .eq(idColumn, spec.rowId(B))
        .select();
      expect(error).toBeNull();
      expect(data).toHaveLength(0);

      const { data: still } = await raw(admin)
        .from(spec.table)
        .select(idColumn)
        .eq(idColumn, spec.rowId(B));
      expect(still).toHaveLength(1);
    });

    it("A cannot insert a row into B's tenant", async () => {
      const { error } = await raw(userA.client)
        .from(spec.table)
        .insert(spec.foreignInsert(B, A));
      expect(error?.code).toBe("42501");
    });
  });

  describe("menu_publications", () => {
    it("A can read B's current publication (the intended public exception)", async () => {
      const { data, error } = await userA.client
        .from("menu_publications")
        .select("id")
        .eq("id", B.currentPublicationId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("A cannot read B's non-current publication", async () => {
      const { data, error } = await userA.client
        .from("menu_publications")
        .select("id")
        .eq("id", B.oldPublicationId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("A can read A's own non-current publication", async () => {
      const { data, error } = await userA.client
        .from("menu_publications")
        .select("id")
        .eq("id", A.oldPublicationId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("nobody can write publications directly", async () => {
      const { data: updated } = await userA.client
        .from("menu_publications")
        .update({ is_current: false })
        .eq("id", A.currentPublicationId)
        .select();
      expect(updated).toHaveLength(0);

      const { data: deleted } = await userA.client
        .from("menu_publications")
        .delete()
        .eq("id", A.currentPublicationId)
        .select();
      expect(deleted).toHaveLength(0);

      const { error } = await userA.client.from("menu_publications").insert({
        menu_id: A.menuId,
        venue_id: A.venueId,
        version: 99,
        snapshot: {},
      });
      expect(error).not.toBeNull();
    });
  });

  describe("guest analytics are append-only via RPC", () => {
    it("a member cannot insert guest_sessions or events directly, even for their own venue", async () => {
      const sessions = await userA.client.from("guest_sessions").insert({ venue_id: A.venueId });
      expect(sessions.error).not.toBeNull();

      const events = await userA.client
        .from("events")
        .insert({ venue_id: A.venueId, event_type: "x" });
      expect(events.error).not.toBeNull();
    });
  });

  describe("RPC boundaries", () => {
    it("A cannot publish or unpublish B's menu", async () => {
      const publish = await userA.client.rpc("publish_menu", { p_menu_id: B.menuId });
      expect(publish.error).not.toBeNull();

      const unpublish = await userA.client.rpc("unpublish_menu", { p_menu_id: B.menuId });
      expect(unpublish.error).not.toBeNull();

      const { data: menu } = await admin
        .from("menus")
        .select("status")
        .eq("id", B.menuId)
        .single();
      expect(menu?.status).toBe("published");
    });

    it("A cannot move A's venue into Org B", async () => {
      const { data } = await userA.client
        .from("venues")
        .update({ organization_id: B.orgId })
        .eq("id", A.venueId)
        .select();
      expect(data ?? []).toHaveLength(0);

      const { data: venue } = await admin
        .from("venues")
        .select("organization_id")
        .eq("id", A.venueId)
        .single();
      expect(venue?.organization_id).toBe(A.orgId);
    });

    it("A cannot add themselves to Org B", async () => {
      const { error } = await userA.client
        .from("memberships")
        .insert({ organization_id: B.orgId, user_id: userA.id, role: "owner" });
      expect(error).not.toBeNull();
    });
  });

  describe("role guards within Org A", () => {
    it("staff can read the org but cannot delete it", async () => {
      const { data: visible } = await userS.client
        .from("organizations")
        .select("id")
        .eq("id", A.orgId);
      expect(visible).toHaveLength(1);

      const { data: deleted } = await userS.client
        .from("organizations")
        .delete()
        .eq("id", A.orgId)
        .select();
      expect(deleted).toHaveLength(0);
    });

    it("staff cannot add memberships", async () => {
      const { error } = await userS.client
        .from("memberships")
        .insert({ organization_id: A.orgId, user_id: userB.id, role: "staff" });
      expect(error).not.toBeNull();
    });

    it("owner can promote staff to manager", async () => {
      const { data, error } = await userA.client
        .from("memberships")
        .update({ role: "manager" })
        .eq("organization_id", A.orgId)
        .eq("user_id", userS.id)
        .select();
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("manager cannot promote themselves to owner", async () => {
      const { data } = await userS.client
        .from("memberships")
        .update({ role: "owner" })
        .eq("organization_id", A.orgId)
        .eq("user_id", userS.id)
        .select();
      expect(data ?? []).toHaveLength(0);

      const { data: membership } = await admin
        .from("memberships")
        .select("role")
        .eq("organization_id", A.orgId)
        .eq("user_id", userS.id)
        .single();
      expect(membership?.role).toBe("manager");
    });

    it("manager cannot remove the owner", async () => {
      const { data } = await userS.client
        .from("memberships")
        .delete()
        .eq("organization_id", A.orgId)
        .eq("user_id", userA.id)
        .select();
      expect(data).toHaveLength(0);
    });
  });
});
