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

    // Upload to Supabase Storage
    // Note: This route is behind authentication (/app/**), and RLS on storage
    // will protect access based on the user's session
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

    // Return full public URL for the uploaded file
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const photoUrl = `${supabaseUrl}/storage/v1/object/public/menu-items/${path}`;

    return NextResponse.json({ path: photoUrl });
  } catch (error) {
    console.error("Storage upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
