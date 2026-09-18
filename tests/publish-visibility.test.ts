// Inactive sections and items must never reach a publish snapshot. Runs against the
// linked Supabase project like the isolation suite; skips without SUPABASE_SECRET_KEY.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  buildOrgFixture,
  cleanup,
  createTestUser,
  secretKey,
  unwrap,
  type Db,
  type OrgFixture,
  type TestUser,
} from "./helpers";

interface SnapshotItem {
  id: string;
  is_available: boolean;
}
interface SnapshotSection {
  id: string;
  items: SnapshotItem[];
  subsections: { id: string; items: SnapshotItem[] }[];
}
interface Snapshot {
  sections: SnapshotSection[];
}

describe.skipIf(!secretKey)("publish_menu respects is_active", () => {
  const runId = Date.now().toString(36);
  let admin: Db;
  let owner: TestUser;
  let fx: OrgFixture;

  beforeAll(async () => {
    admin = adminClient();
    owner = await createTestUser(admin, "vis", runId);
    fx = await buildOrgFixture(owner, admin, "vis", runId);
  });

  afterAll(async () => {
    await cleanup(admin, runId, [owner.id]);
  });

  it("defaults new sections and items to active", async () => {
    const section = unwrap(
      await owner.client.from("menu_sections").select("is_active").eq("id", fx.sectionId).single()
    );
    const item = unwrap(
      await owner.client.from("menu_items").select("is_active").eq("id", fx.itemId).single()
    );
    expect(section.is_active).toBe(true);
    expect(item.is_active).toBe(true);
  });

  it("omits inactive sections and items from the snapshot, keeps sold-out items", async () => {
    const c = owner.client;

    const hiddenSection = unwrap(
      await c
        .from("menu_sections")
        .insert({ menu_id: fx.menuId, venue_id: fx.venueId, name: "Seasonal", is_active: false })
        .select()
        .single()
    );
    const hiddenItem = unwrap(
      await c
        .from("menu_items")
        .insert({
          section_id: fx.sectionId,
          venue_id: fx.venueId,
          name: "Secret",
          price_minor: 100,
          is_active: false,
        })
        .select()
        .single()
    );
    const soldOutItem = unwrap(
      await c
        .from("menu_items")
        .insert({
          section_id: fx.sectionId,
          venue_id: fx.venueId,
          name: "Sold out",
          price_minor: 100,
          is_available: false,
        })
        .select()
        .single()
    );

    const pub = unwrap(await c.rpc("publish_menu", { p_menu_id: fx.menuId }));
    const snapshot = pub.snapshot as unknown as Snapshot;

    const sectionIds = snapshot.sections.map((s) => s.id);
    expect(sectionIds).toContain(fx.sectionId);
    expect(sectionIds).not.toContain(hiddenSection.id);

    const visible = snapshot.sections.find((s) => s.id === fx.sectionId)!;
    const itemIds = visible.items.map((i) => i.id);
    expect(itemIds).toContain(fx.itemId);
    expect(itemIds).toContain(soldOutItem.id);
    expect(itemIds).not.toContain(hiddenItem.id);
    expect(visible.items.find((i) => i.id === soldOutItem.id)!.is_available).toBe(false);
  });

  it("nests subsections with their own items, hidden along with their parent", async () => {
    const c = owner.client;

    const parent = unwrap(
      await c
        .from("menu_sections")
        .insert({ menu_id: fx.menuId, venue_id: fx.venueId, name: "Pizzas" })
        .select()
        .single()
    );
    const child = unwrap(
      await c
        .from("menu_sections")
        .insert({
          menu_id: fx.menuId,
          venue_id: fx.venueId,
          name: "Specialty",
          parent_section_id: parent.id,
        })
        .select()
        .single()
    );
    const parentItem = unwrap(
      await c
        .from("menu_items")
        .insert({ section_id: parent.id, venue_id: fx.venueId, name: "Margherita", price_minor: 900 })
        .select()
        .single()
    );
    const childItem = unwrap(
      await c
        .from("menu_items")
        .insert({ section_id: child.id, venue_id: fx.venueId, name: "Truffle", price_minor: 1500 })
        .select()
        .single()
    );

    let snapshot = unwrap(await c.rpc("publish_menu", { p_menu_id: fx.menuId }))
      .snapshot as unknown as Snapshot;
    const top = snapshot.sections.find((s) => s.id === parent.id)!;
    expect(top.items.map((i) => i.id)).toEqual([parentItem.id]);
    expect(top.subsections.map((s) => s.id)).toEqual([child.id]);
    expect(top.subsections[0].items.map((i) => i.id)).toEqual([childItem.id]);
    // Subsections never appear at the top level.
    expect(snapshot.sections.map((s) => s.id)).not.toContain(child.id);

    // Hiding only the child removes it but keeps the parent.
    expect(
      (await c.from("menu_sections").update({ is_active: false }).eq("id", child.id)).error
    ).toBeNull();
    snapshot = unwrap(await c.rpc("publish_menu", { p_menu_id: fx.menuId }))
      .snapshot as unknown as Snapshot;
    expect(snapshot.sections.find((s) => s.id === parent.id)!.subsections).toEqual([]);

    // Hiding the parent removes both.
    expect(
      (await c.from("menu_sections").update({ is_active: true }).eq("id", child.id)).error
    ).toBeNull();
    expect(
      (await c.from("menu_sections").update({ is_active: false }).eq("id", parent.id)).error
    ).toBeNull();
    snapshot = unwrap(await c.rpc("publish_menu", { p_menu_id: fx.menuId }))
      .snapshot as unknown as Snapshot;
    expect(snapshot.sections.map((s) => s.id)).not.toContain(parent.id);
  });

  it("rejects nesting deeper than one level", async () => {
    const c = owner.client;
    const parent = unwrap(
      await c
        .from("menu_sections")
        .insert({ menu_id: fx.menuId, venue_id: fx.venueId, name: "Level 1" })
        .select()
        .single()
    );
    const child = unwrap(
      await c
        .from("menu_sections")
        .insert({
          menu_id: fx.menuId,
          venue_id: fx.venueId,
          name: "Level 2",
          parent_section_id: parent.id,
        })
        .select()
        .single()
    );

    const grandchild = await c.from("menu_sections").insert({
      menu_id: fx.menuId,
      venue_id: fx.venueId,
      name: "Level 3",
      parent_section_id: child.id,
    });
    expect(grandchild.error?.code).toBe("23514");

    // A section that already has children can't be demoted under another.
    const demote = await c
      .from("menu_sections")
      .update({ parent_section_id: fx.sectionId })
      .eq("id", parent.id);
    expect(demote.error?.code).toBe("23514");
  });

  it("publishing another menu in the venue retires the current one", async () => {
    const c = owner.client;

    // Fixture menu is currently published; add a second menu and publish it.
    const second = unwrap(
      await c
        .from("menus")
        .insert({ venue_id: fx.venueId, name: "Second" })
        .select()
        .single()
    );
    const pub = unwrap(await c.rpc("publish_menu", { p_menu_id: second.id }));
    expect(pub.is_current).toBe(true);

    const current = unwrap(
      await c
        .from("menu_publications")
        .select("menu_id")
        .eq("venue_id", fx.venueId)
        .eq("is_current", true)
    );
    expect(current).toEqual([{ menu_id: second.id }]);

    const first = unwrap(await c.from("menus").select("status").eq("id", fx.menuId).single());
    expect(first.status).toBe("draft");

    // Publishing the original again swaps back.
    unwrap(await c.rpc("publish_menu", { p_menu_id: fx.menuId }));
    const swapped = unwrap(
      await c
        .from("menu_publications")
        .select("menu_id")
        .eq("venue_id", fx.venueId)
        .eq("is_current", true)
    );
    expect(swapped).toEqual([{ menu_id: fx.menuId }]);
  });

  it("re-including a section brings it back on the next publish", async () => {
    const c = owner.client;
    const section = unwrap(
      await c
        .from("menu_sections")
        .insert({ menu_id: fx.menuId, venue_id: fx.venueId, name: "Toggled", is_active: false })
        .select()
        .single()
    );

    let pub = unwrap(await c.rpc("publish_menu", { p_menu_id: fx.menuId }));
    expect((pub.snapshot as unknown as Snapshot).sections.map((s) => s.id)).not.toContain(
      section.id
    );

    const updated = await c.from("menu_sections").update({ is_active: true }).eq("id", section.id);
    expect(updated.error).toBeNull();

    pub = unwrap(await c.rpc("publish_menu", { p_menu_id: fx.menuId }));
    expect((pub.snapshot as unknown as Snapshot).sections.map((s) => s.id)).toContain(section.id);
  });
});
