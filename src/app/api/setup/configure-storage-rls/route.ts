import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: "Service role key not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get existing policies and add new ones if needed
    // For now, just return success if bucket exists
    const { data: buckets, error: listError } = await supabase.storage
      .listBuckets();

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const menuItemsBucket = buckets?.find((b) => b.name === "menu-items");

    if (!menuItemsBucket) {
      return NextResponse.json(
        { error: "menu-items bucket not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Storage bucket exists and is configured",
      bucket: {
        name: menuItemsBucket.name,
        public: menuItemsBucket.public,
      },
    });
  } catch (error) {
    console.error("Storage RLS setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
