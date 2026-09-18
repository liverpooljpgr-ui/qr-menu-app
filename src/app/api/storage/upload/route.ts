import { createClient } from "@/lib/supabase/server";
import { ASSET_RULES, STORAGE_BUCKETS, isAssetKind } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const venueId = formData.get("venueId");
    const kind = formData.get("kind") ?? "menu-item";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (typeof venueId !== "string" || !venueId) {
      return NextResponse.json({ error: "No venueId provided" }, { status: 400 });
    }
    if (!isAssetKind(kind)) {
      return NextResponse.json({ error: "Unknown asset kind" }, { status: 400 });
    }

    const rules = ASSET_RULES[kind];
    if (!rules.mimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type. Allowed: ${rules.mimeTypes.join(", ")}` },
        { status: 400 }
      );
    }
    if (file.size > rules.maxBytes) {
      return NextResponse.json(
        { error: `File exceeds ${Math.round(rules.maxBytes / 1024 / 1024)} MB limit` },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${venueId}/${Date.now()}-${safeName}`;

    // Storage RLS enforces bucket + venue-folder membership for the session user.
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS[kind])
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Upload failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ path });
  } catch (error) {
    console.error("Storage upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
