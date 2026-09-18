import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const venueId = formData.get("venueId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!venueId) {
      return NextResponse.json({ error: "No venueId provided" }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify user has access to this venue through memberships
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("id, organization_id")
      .eq("id", venueId)
      .single();

    if (venueError || !venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    // Check if user is a member of the organization
    const { data: membership, error: memberError } = await supabase
      .from("memberships")
      .select("id")
      .eq("organization_id", venue.organization_id)
      .single();

    if (memberError || !membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Upload to Supabase Storage
    const filename = `${Date.now()}-${file.name}`;
    const path = `${venueId}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from("menu-items")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

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
