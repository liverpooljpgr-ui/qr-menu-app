import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface ReorderItem {
  id: string;
  position: number;
}

export async function POST(request: NextRequest) {
  try {
    const { items, type } = (await request.json()) as {
      items: ReorderItem[];
      type: "sections" | "items";
    };

    if (!items || !type) {
      return NextResponse.json(
        { error: "Missing items or type" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Batch update positions
    const table = type === "sections" ? "menu_sections" : "menu_items";
    const promises = items.map((item) =>
      supabase
        .from(table)
        .update({ position: item.position })
        .eq("id", item.id)
    );

    const results = await Promise.all(promises);

    // Check for errors
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      console.error("Reorder errors:", errors);
      return NextResponse.json(
        { error: "Failed to reorder items" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reorder error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
