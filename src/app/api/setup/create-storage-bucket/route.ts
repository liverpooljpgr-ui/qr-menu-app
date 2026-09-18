import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // Use admin client (service role) to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseServiceKey) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY not configured",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Try to create the menu-items storage bucket
    const { data, error } = await supabase.storage.createBucket(
      "menu-items",
      {
        public: true,
        fileSizeLimit: 52428800, // 50MB
      }
    );

    if (error) {
      // If bucket already exists, that's fine
      if (error.message.includes("already exists")) {
        return NextResponse.json({
          success: true,
          message: "Bucket already exists",
        });
      }
      console.error("Error creating bucket:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Storage bucket created successfully",
      data,
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
