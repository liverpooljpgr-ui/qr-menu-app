// Storage rule: one bucket per asset kind, objects named "{venue_id}/{file}",
// writes limited to members of that venue's organization, reads public.
// Runs against the linked project; skips without SUPABASE_SECRET_KEY.

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

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64"
);
const png = () => new Blob([PNG_1PX], { type: "image/png" });

const BUCKETS = ["menu-items", "venue-logos"] as const;

describe.skipIf(!secretKey)("storage bucket policies", () => {
  const runId = Date.now().toString(36);
  let admin: Db;
  let userA: TestUser;
  let userB: TestUser;
  let A: OrgFixture;
  let B: OrgFixture;
  const uploaded: { bucket: string; path: string }[] = [];

  beforeAll(async () => {
    admin = adminClient();
    userA = await createTestUser(admin, "sa", runId);
    userB = await createTestUser(admin, "sb", runId);
    A = await buildOrgFixture(userA, admin, "sa", runId);
    B = await buildOrgFixture(userB, admin, "sb", runId);
  });

  afterAll(async () => {
    for (const bucket of BUCKETS) {
      const paths = uploaded.filter((u) => u.bucket === bucket).map((u) => u.path);
      if (paths.length) await admin.storage.from(bucket).remove(paths);
    }
    await cleanup(admin, runId, [userA.id, userB.id]);
  });

  describe.each(BUCKETS)("%s", (bucket) => {
    it("member can upload under their own venue and anyone can read it", async () => {
      const path = `${A.venueId}/${runId}-own.png`;
      const { error } = await userA.client.storage.from(bucket).upload(path, png());
      expect(error).toBeNull();
      uploaded.push({ bucket, path });

      const url = userA.client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      const res = await fetch(url);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
    });

    it("member cannot upload under another org's venue", async () => {
      const path = `${B.venueId}/${runId}-foreign.png`;
      const { error } = await userA.client.storage.from(bucket).upload(path, png());
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/row-level security/i);
    });

    it("member cannot upload outside a venue folder", async () => {
      const path = `${runId}-loose.png`;
      const { error } = await userA.client.storage.from(bucket).upload(path, png());
      expect(error).not.toBeNull();
    });

    it("member cannot delete another org's object", async () => {
      const path = `${B.venueId}/${runId}-theirs.png`;
      const up = await userB.client.storage.from(bucket).upload(path, png());
      expect(up.error).toBeNull();
      uploaded.push({ bucket, path });

      // Storage returns success with an empty list when RLS filters everything out.
      const { data } = await userA.client.storage.from(bucket).remove([path]);
      expect(data ?? []).toHaveLength(0);
      const { data: still } = await admin.storage.from(bucket).list(B.venueId);
      expect(still?.some((f) => path.endsWith(`/${f.name}`))).toBe(true);
    });
  });

  it("rejects mime types a bucket doesn't allow", async () => {
    const path = `${A.venueId}/${runId}-logo.svg`;
    const svg = new Blob(["<svg xmlns='http://www.w3.org/2000/svg'/>"], { type: "image/svg+xml" });

    const logos = await userA.client.storage.from("venue-logos").upload(path, svg);
    expect(logos.error).toBeNull();
    uploaded.push({ bucket: "venue-logos", path });

    const items = await userA.client.storage.from("menu-items").upload(path, svg);
    expect(items.error).not.toBeNull();
    expect(items.error!.message).toMatch(/mime type/i);
  });
});
