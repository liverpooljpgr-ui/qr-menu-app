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
