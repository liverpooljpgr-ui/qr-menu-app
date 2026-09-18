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
        console.log("Bucket already exists, skipping creation");
        // Bucket exists, continue to configure RLS
      } else {
        console.error("Error creating bucket:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      console.log("Bucket created successfully");
    }

    // Note: RLS policies for storage buckets need to be configured manually
    // in the Supabase dashboard or via SQL. For now, the bucket is created as public.
    // To allow uploads, ensure the storage.objects table has RLS policies like:
    // - Allow authenticated users to insert into storage.objects
    // - Allow all users to select/download from storage.objects (for public bucket)

    return NextResponse.json({
      success: true,
      message: "Storage bucket 'menu-items' is ready. Configure RLS in Supabase dashboard if uploads are blocked.",
      data: { name: "menu-items", public: true },
      instructions:
        "If uploads fail, create an RLS policy on storage.objects table: " +
        "auth.role() = 'authenticated' for INSERT, allow SELECT for all users",
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
